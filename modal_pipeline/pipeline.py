"""
PitchScout CV Pipeline — Modal.com
====================================

DEPLOY:
    modal deploy modal_pipeline/pipeline.py

SECRETS (configure in Modal dashboard before deploying):
    modal secret create aws-credentials \
        AWS_ACCESS_KEY_ID=<your-key> \
        AWS_SECRET_ACCESS_KEY=<your-secret> \
        AWS_DEFAULT_REGION=us-east-1

TRIGGER (POST):
    curl -X POST <modal-web-endpoint-url> \
         -H "Content-Type: application/json" \
         -d '{"job_id":"abc123","video_s3_key":"jobs/abc123/video.mp4","results_bucket":"my-bucket"}'

WHAT IT DOES:
    1. Downloads the video from S3 and splits it into N_CHUNKS segments (ffmpeg).
    2. Runs N_CHUNKS GPU containers in parallel, each processing one segment:
         a. YOLOv8 player/ball detection in batches of BATCH_SIZE frames.
         b. ByteTrack multi-object tracking.
         c. SigLIP + UMAP + KMeans team classification.
    3. Merges chunk results: frames, trajectory, possession, distances, territory.
    4. Gzip-compresses results.json and writes it to S3.
    5. Updates meta.json status at each phase.
"""

import modal
import json
import boto3
import subprocess
import tempfile
import os
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# App + images
# ---------------------------------------------------------------------------

app = modal.App("pitchscout-lab")

# Full CV image — used by run_pipeline_chunk
cv_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1", "libglib2.0-0")
    .pip_install(
        "ultralytics>=8.3",
        "supervision>=0.25",
        "boto3>=1.34",
        "torch",
        "torchvision",
        "transformers>=4.40",
        "sentencepiece>=0.1.99",
        "scikit-learn>=1.4",
        "umap-learn>=0.5",
        "opencv-python-headless>=4.9",
        "numpy>=1.26",
        "Pillow>=10.0",
        "fastapi[standard]>=0.100",
    )
)

# Lightweight orchestrator image — needs ffmpeg + boto3, no GPU deps
orchestrate_image = (
    modal.Image.debian_slim()
    .apt_install("ffmpeg")
    .pip_install("boto3>=1.34", "fastapi[standard]>=0.100")
)

# Trigger image — minimal, just receives the HTTP request
trigger_image = modal.Image.debian_slim().pip_install("fastapi[standard]>=0.100", "boto3>=1.34")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STRIDE = 5        # Sample every N-th frame
BATCH_SIZE = 8    # YOLO inference batch size
N_CHUNKS = 6      # Parallel video segments

PLAYER_MODEL_SRC = "yolov8x.pt"
KEYPOINT_MODEL_SRC = None

COCO_PERSON = 0
COCO_BALL = 32

SIGLIP_MODEL_ID = "google/siglip-base-patch16-224"

PITCH_WIDTH_M = 105.0
PITCH_HEIGHT_M = 68.0

PITCH_KEYPOINTS_M = [
    (0.0, 0.0),       (52.5, 0.0),      (105.0, 0.0),
    (0.0, 13.84),     (16.5, 13.84),    (105.0, 13.84),
    (88.5, 13.84),    (0.0, 24.84),     (5.5, 24.84),
    (105.0, 24.84),   (99.5, 24.84),    (0.0, 34.0),
    (52.5, 34.0),     (105.0, 34.0),    (0.0, 43.16),
    (52.5, 43.16),    (105.0, 43.16),   (0.0, 54.16),
    (5.5, 54.16),     (105.0, 54.16),   (99.5, 54.16),
    (0.0, 43.16),     (11.0, 34.0),     (105.0, 43.16),
    (94.0, 34.0),     (0.0, 68.0),      (52.5, 68.0),
    (105.0, 68.0),    (0.0, 54.16),     (16.5, 54.16),
    (105.0, 54.16),   (88.5, 54.16),
]

CLASS_PLAYER = 0
CLASS_GOALKEEPER = 1
CLASS_BALL = 2
CLASS_REFEREE = 3


# ---------------------------------------------------------------------------
# Helper: S3 meta update
# ---------------------------------------------------------------------------

def _make_update_meta(s3_client, job_id: str, results_bucket: str, base_meta: dict):
    def update_meta(status: str, progress: int, error: str = None, results_key: str = None):
        base_meta["status"] = status
        base_meta["progress"] = progress
        if error is not None:
            base_meta["error"] = error
        if results_key is not None:
            base_meta["resultsKey"] = results_key
            base_meta["completedAt"] = datetime.now(timezone.utc).isoformat()
        s3_client.put_object(
            Bucket=results_bucket,
            Key=f"jobs/{job_id}/meta.json",
            Body=json.dumps(base_meta),
            ContentType="application/json",
        )
    return update_meta


# ---------------------------------------------------------------------------
# Helper: batch detection + tracking
# ---------------------------------------------------------------------------

def _process_detection_batch(
    frames: list,
    frame_metas: list,
    player_model,
    tracker,
    frames_raw: list,
    all_crops: dict,
    frame_w: int,
    frame_h: int,
):
    """
    Run one YOLO batch, update ByteTrack, append to frames_raw.
    frames_raw and all_crops are mutated in-place.
    """
    import supervision as sv
    import numpy as np

    batch_results = player_model(frames, imgsz=1280, verbose=False)

    for (frame_num, t), result, frame in zip(frame_metas, batch_results, frames):
        detections = sv.Detections.from_ultralytics(result)

        if detections.class_id is not None:
            remapped = np.where(
                detections.class_id == COCO_BALL,
                CLASS_BALL,
                np.where(detections.class_id == COCO_PERSON, CLASS_PLAYER, -1),
            )
            keep = remapped >= 0
            detections = detections[keep]
            if detections.class_id is not None:
                detections.class_id = remapped[keep]

        detections = tracker.update_with_detections(detections)

        ball_xy_img = None
        if detections.class_id is not None:
            ball_mask = detections.class_id == CLASS_BALL
            if ball_mask.any():
                ball_dets = detections[ball_mask]
                best = int(np.argmax(ball_dets.confidence))
                bx1, by1, bx2, by2 = ball_dets.xyxy[best]
                ball_xy_img = (float((bx1 + bx2) / 2), float((by1 + by2) / 2))

        player_entries = []
        if detections.tracker_id is not None:
            for i in range(len(detections)):
                tid = detections.tracker_id[i]
                cid = detections.class_id[i] if detections.class_id is not None else -1
                if tid is None or cid not in (CLASS_PLAYER, CLASS_GOALKEEPER):
                    continue
                x1, y1, x2, y2 = map(int, detections.xyxy[i])
                cx, cy = float((x1 + x2) / 2), float((y1 + y2) / 2)

                # Sample crops for team classification
                if len(frames_raw) % (30 // STRIDE + 1) == 0:
                    crop = frame[max(0, y1):y2, max(0, x1):x2]
                    if crop.size > 0:
                        all_crops.setdefault(int(tid), []).append(crop)

                player_entries.append({
                    "id": int(tid),
                    "role": "goalkeeper" if cid == CLASS_GOALKEEPER else "player",
                    "img_cx": cx,
                    "img_cy": cy,
                })

        frames_raw.append({
            "frame_num": frame_num,
            "t": t,
            "players": player_entries,
            "ball_xy_img": ball_xy_img,
        })


# ---------------------------------------------------------------------------
# Helper: SigLIP + UMAP + KMeans team classification
# ---------------------------------------------------------------------------

def _classify_teams(all_crops: dict, device: str) -> dict:
    import torch
    import numpy as np
    from PIL import Image as PILImage
    from transformers import AutoProcessor, AutoModel
    from sklearn.cluster import KMeans
    from umap import UMAP

    tracker_ids = list(all_crops.keys())
    if len(tracker_ids) < 2:
        return {tid: 0 for tid in tracker_ids}

    sample_crops = []
    for tid in tracker_ids:
        for crop in all_crops[tid][-5:]:
            import cv2
            sample_crops.append((tid, cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))

    if len(sample_crops) < 2:
        return {tid: 0 for tid in tracker_ids}

    processor = AutoProcessor.from_pretrained(SIGLIP_MODEL_ID)
    model = AutoModel.from_pretrained(SIGLIP_MODEL_ID).to(device)
    model.eval()

    pil_images = [PILImage.fromarray(crop) for _, crop in sample_crops]
    embeddings = []
    with torch.no_grad():
        for i in range(0, len(pil_images), 32):
            batch = pil_images[i: i + 32]
            inputs = processor(images=batch, return_tensors="pt", padding=True).to(device)
            outputs = model.get_image_features(**inputs)
            if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
                feats = outputs.pooler_output
            elif hasattr(outputs, "last_hidden_state"):
                feats = outputs.last_hidden_state[:, 0, :]
            else:
                feats = outputs
            embeddings.append(feats.cpu().float().numpy())

    embeddings_np = np.vstack(embeddings)
    norms = np.linalg.norm(embeddings_np, axis=1, keepdims=True)
    embeddings_np = embeddings_np / np.where(norms == 0, 1.0, norms)

    n_neighbors = min(15, len(embeddings_np) - 1)
    reduced = UMAP(n_components=2, n_neighbors=n_neighbors, random_state=42).fit_transform(embeddings_np)
    labels = KMeans(n_clusters=2, random_state=42, n_init=10).fit_predict(reduced)

    from collections import defaultdict, Counter
    tid_labels = defaultdict(list)
    for (tid, _), label in zip(sample_crops, labels):
        tid_labels[tid].append(label)

    return {
        tid: int(Counter(tid_labels[tid]).most_common(1)[0][0]) if tid in tid_labels else 0
        for tid in tracker_ids
    }


# ---------------------------------------------------------------------------
# Helper: aggregate raw frames into output data + stats
# ---------------------------------------------------------------------------

def _aggregate_frames(
    frames_raw: list,
    team_assignments: dict,
    frame_w: int,
    frame_h: int,
    chunk_idx: int,
) -> dict:
    """
    Convert raw detection frames to output format.
    Player IDs are globally unique: chunk_idx * 100_000 + local_tracker_id.
    """
    frames_data = []
    ball_positions = []
    team_ball_frames = {0: 0, 1: 0}
    player_distances = {}
    player_last_pos = {}
    team_territory = {0: 0.0, 1: 0.0}

    for fr in frames_raw:
        frame_players = []
        frame_team_positions = {0: [], 1: []}

        for p in fr["players"]:
            local_tid = p["id"]
            global_tid = chunk_idx * 100_000 + local_tid
            team = team_assignments.get(local_tid, 0)
            role = p["role"]

            pitch_x = p["img_cx"] / frame_w * PITCH_WIDTH_M
            pitch_y = p["img_cy"] / frame_h * PITCH_HEIGHT_M

            frame_players.append({
                "id": global_tid,
                "team": team,
                "role": role,
                "pitch_x": pitch_x,
                "pitch_y": pitch_y,
            })

            frame_team_positions[team].append((pitch_x, pitch_y))
            team_territory[team] += pitch_x

            if global_tid in player_last_pos:
                lx, ly = player_last_pos[global_tid]
                d = ((pitch_x - lx) ** 2 + (pitch_y - ly) ** 2) ** 0.5
                player_distances.setdefault(global_tid, {"team": team, "metres": 0.0})
                player_distances[global_tid]["metres"] += d
            player_last_pos[global_tid] = (pitch_x, pitch_y)

        ball_pitch = None
        if fr["ball_xy_img"]:
            try:
                bx, by = fr["ball_xy_img"]
                bpx = bx / frame_w * PITCH_WIDTH_M
                bpy = by / frame_h * PITCH_HEIGHT_M
                ball_pitch = {"pitch_x": bpx, "pitch_y": bpy}
                ball_positions.append([bpx, bpy])

                nearest_team, nearest_dist = None, float("inf")
                for team_id, positions in frame_team_positions.items():
                    for (px2, py2) in positions:
                        d = ((bpx - px2) ** 2 + (bpy - py2) ** 2) ** 0.5
                        if d < nearest_dist:
                            nearest_dist = d
                            nearest_team = team_id
                if nearest_team is not None and nearest_dist < 5.0:
                    team_ball_frames[nearest_team] += 1
            except Exception:
                pass

        frames_data.append({
            "t": round(fr["t"], 3),
            "players": frame_players,
            "ball": ball_pitch,
        })

    return {
        "frames_data": frames_data,
        "ball_positions": ball_positions,
        "team_ball_frames": team_ball_frames,
        "player_distances": player_distances,
        "team_territory": team_territory,
    }


# ---------------------------------------------------------------------------
# Helper: merge N chunk results into final results dict
# ---------------------------------------------------------------------------

def _merge_chunks(chunks: list) -> dict:
    chunks = sorted(chunks, key=lambda c: c["chunk_idx"])

    all_frames = []
    for c in chunks:
        all_frames.extend(c["frames_data"])
    all_frames.sort(key=lambda f: f["t"])

    all_trajectory = []
    for c in chunks:
        all_trajectory.extend(c["ball_positions"])

    total_ball_0 = sum(c["team_ball_frames"][0] for c in chunks)
    total_ball_1 = sum(c["team_ball_frames"][1] for c in chunks)
    total_ball = (total_ball_0 + total_ball_1) or 1
    possession = [
        round(total_ball_0 / total_ball * 100, 1),
        round(total_ball_1 / total_ball * 100, 1),
    ]

    all_distances: dict = {}
    for c in chunks:
        all_distances.update(c["player_distances"])
    distances_list = [
        {"id": gid, "team": info["team"], "metres": round(info["metres"], 1)}
        for gid, info in all_distances.items()
    ]
    distances_list.sort(key=lambda x: x["metres"], reverse=True)

    total_territory_0 = sum(c["team_territory"][0] for c in chunks)
    total_territory_1 = sum(c["team_territory"][1] for c in chunks)
    total_territory = (total_territory_0 + total_territory_1) or 1.0
    territory = [
        round(total_territory_0 / total_territory * 100, 1),
        round(total_territory_1 / total_territory * 100, 1),
    ]

    total_duration = sum(c["duration"] for c in chunks)
    fps_sampled = chunks[0]["fps_sampled"] if chunks else round(30 / STRIDE, 3)
    total_frame_count = sum(c["frame_count"] for c in chunks)

    return {
        "meta": {
            "fps": fps_sampled,
            "duration": round(total_duration, 2),
            "frameCount": total_frame_count,
        },
        "frames": all_frames,
        "trajectory": all_trajectory,
        "stats": {
            "possession": possession,
            "distances": distances_list,
            "territory": territory,
        },
    }


# ---------------------------------------------------------------------------
# GPU function: process one video chunk
# ---------------------------------------------------------------------------

@app.function(
    image=cv_image,
    gpu="T4",
    timeout=3600,
    secrets=[modal.Secret.from_name("aws-credentials")],
)
def run_pipeline_chunk(
    chunk_s3_key: str,
    results_bucket: str,
    chunk_idx: int,
    time_offset: float,
) -> dict:
    """
    Download one video chunk from S3, run detection + tracking + classification,
    return aggregated result dict. Does NOT write to S3.
    """
    import cv2
    import torch
    import supervision as sv
    from ultralytics import YOLO as _YOLO

    device = "cuda" if torch.cuda.is_available() else "cpu"
    s3 = boto3.client("s3")

    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        chunk_path = f.name

    try:
        s3.download_file(results_bucket, chunk_s3_key, chunk_path)

        # Remove any stale cached model file from a previous failed run
        if os.path.exists("/tmp/player_model.pt"):
            os.unlink("/tmp/player_model.pt")

        player_model = _YOLO(PLAYER_MODEL_SRC)

        cap = cv2.VideoCapture(chunk_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        duration = total_frames / fps

        tracker = sv.ByteTrack()
        frames_raw: list = []
        all_crops: dict = {}
        frame_num = 0
        frame_w, frame_h = 1920, 1080

        frame_buffer: list = []
        frame_metas: list = []

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            frame_num += 1
            if frame_num % STRIDE != 0:
                continue
            if frame_num == STRIDE:
                frame_h, frame_w = frame.shape[:2]

            frame_buffer.append(frame.copy())
            frame_metas.append((frame_num, time_offset + frame_num / fps))

            if len(frame_buffer) >= BATCH_SIZE:
                _process_detection_batch(
                    frame_buffer, frame_metas,
                    player_model, tracker,
                    frames_raw, all_crops,
                    frame_w, frame_h,
                )
                frame_buffer = []
                frame_metas = []

        # Flush remaining frames
        if frame_buffer:
            _process_detection_batch(
                frame_buffer, frame_metas,
                player_model, tracker,
                frames_raw, all_crops,
                frame_w, frame_h,
            )

        cap.release()

        team_assignments = _classify_teams(all_crops, device)
        agg = _aggregate_frames(frames_raw, team_assignments, frame_w, frame_h, chunk_idx)

        return {
            "chunk_idx": chunk_idx,
            "frame_count": len(agg["frames_data"]),
            "duration": round(duration, 3),
            "fps_sampled": round(fps / STRIDE, 3),
            **agg,
        }

    finally:
        if os.path.exists(chunk_path):
            os.unlink(chunk_path)


# ---------------------------------------------------------------------------
# Orchestrator: split → parallel chunks → merge → write results
# ---------------------------------------------------------------------------

@app.function(
    image=orchestrate_image,
    timeout=7200,
    secrets=[modal.Secret.from_name("aws-credentials")],
)
def orchestrate(job_id: str, video_s3_key: str, results_bucket: str):
    """
    CPU-only orchestrator.
    1. Downloads the full video.
    2. Splits into N_CHUNKS segments with ffmpeg (-c copy, no re-encode).
    3. Uploads each chunk to S3 under jobs/<job_id>/chunks/.
    4. Runs run_pipeline_chunk in parallel via .starmap().
    5. Merges results and writes final results.json + meta.json to S3.
    6. Deletes chunk files from S3.
    """
    import gzip as _gzip

    s3 = boto3.client("s3")

    try:
        obj = s3.get_object(Bucket=results_bucket, Key=f"jobs/{job_id}/meta.json")
        base_meta = json.loads(obj["Body"].read())
    except Exception:
        base_meta = {
            "id": job_id,
            "videoKey": video_s3_key,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

    update_meta = _make_update_meta(s3, job_id, results_bucket, base_meta)
    video_path = None
    chunk_s3_keys: list = []

    try:
        update_meta("processing", 2)

        # ── Download full video ────────────────────────────────────────────
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            video_path = f.name
        s3.download_file(results_bucket, video_s3_key, video_path)
        update_meta("processing", 8)

        # ── Get video duration ─────────────────────────────────────────────
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "json", video_path],
            capture_output=True, text=True, check=True,
        )
        total_duration = float(json.loads(probe.stdout)["format"]["duration"])
        chunk_dur = total_duration / N_CHUNKS

        # ── Split + upload chunks ──────────────────────────────────────────
        with tempfile.TemporaryDirectory() as tmpdir:
            for i in range(N_CHUNKS):
                start = i * chunk_dur
                local_path = os.path.join(tmpdir, f"chunk_{i:03d}.mp4")
                subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-ss", str(start),
                        "-i", video_path,
                        "-t", str(chunk_dur),
                        "-c", "copy",
                        local_path,
                    ],
                    check=True,
                    capture_output=True,
                )
                chunk_key = f"jobs/{job_id}/chunks/chunk_{i:03d}.mp4"
                s3.upload_file(local_path, results_bucket, chunk_key)
                chunk_s3_keys.append(chunk_key)
                update_meta("processing", 8 + int((i + 1) / N_CHUNKS * 7))

        # Free disk space before GPU phase
        if video_path and os.path.exists(video_path):
            os.unlink(video_path)
            video_path = None

        update_meta("processing", 15)

        # ── Run all chunks in parallel ─────────────────────────────────────
        chunk_args = [
            (chunk_s3_keys[i], results_bucket, i, i * chunk_dur)
            for i in range(N_CHUNKS)
        ]
        chunk_results = list(run_pipeline_chunk.starmap(chunk_args))

        update_meta("processing", 90)

        # ── Merge + write ──────────────────────────────────────────────────
        results = _merge_chunks(chunk_results)

        results_key = f"jobs/{job_id}/results.json"
        body = _gzip.compress(json.dumps(results).encode("utf-8"))
        s3.put_object(
            Bucket=results_bucket,
            Key=results_key,
            Body=body,
            ContentType="application/json",
            ContentEncoding="gzip",
        )

        # Clean up chunk files
        for key in chunk_s3_keys:
            try:
                s3.delete_object(Bucket=results_bucket, Key=key)
            except Exception:
                pass

        update_meta("done", 100, results_key=results_key)

    except Exception as exc:
        update_meta("error", base_meta.get("progress", 0), error=str(exc))
        raise

    finally:
        if video_path and os.path.exists(video_path):
            os.unlink(video_path)


# ---------------------------------------------------------------------------
# Non-blocking web endpoint
# ---------------------------------------------------------------------------

@app.function(image=trigger_image, secrets=[modal.Secret.from_name("aws-credentials")])
@modal.fastapi_endpoint(method="POST")
def trigger(body: dict):
    """
    POST endpoint. Returns immediately; orchestrate runs asynchronously.

    Body (JSON):
        job_id         str
        video_s3_key   str
        results_bucket str
    """
    job_id = body.get("job_id")
    video_s3_key = body.get("video_s3_key")
    results_bucket = body.get("results_bucket")

    if not all([job_id, video_s3_key, results_bucket]):
        return {"error": "Missing required fields: job_id, video_s3_key, results_bucket"}

    orchestrate.spawn(
        job_id=job_id,
        video_s3_key=video_s3_key,
        results_bucket=results_bucket,
    )

    return {"ok": True, "job_id": job_id}
