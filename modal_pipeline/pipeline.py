"""
PitchScout CV Pipeline — Modal.com
===================================

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
    1. Downloads the video from S3.
    2. Runs YOLOv8 player detection + ByteTrack tracking (every STRIDE-th frame).
    3. Classifies players into two teams via SigLIP embeddings → UMAP → KMeans.
    4. Detects pitch keypoints, computes homography, maps players to pitch coords.
    5. Aggregates frames, trajectory, possession, distances, territory into results.json.
    6. Gzip-compresses results.json and writes it to S3.
    7. Updates meta.json status at each phase.
"""

import modal
import json
import boto3
import tempfile
import os
from datetime import datetime, timezone

# ---------------------------------------------------------------------------
# App + image
# ---------------------------------------------------------------------------

app = modal.App("pitchscout-lab")

image = (
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

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

STRIDE = 5  # Process every 5th frame

# Model sources
# Using standard ultralytics COCO model for player/ball detection (no auth needed).
# Fine-tuned Roboflow football models can replace these once model weight download
# is unblocked (Roboflow API currently returns dataset ZIPs, not .pt weights).
PLAYER_MODEL_SRC = "yolov8x.pt"   # person=0, sports ball=32 in COCO
KEYPOINT_MODEL_SRC = None          # pitch keypoint detection — disabled for now

# COCO class IDs used for detection remapping
COCO_PERSON = 0
COCO_BALL = 32

SIGLIP_MODEL_ID = "google/siglip-base-patch16-224"

# FIFA standard pitch dimensions (metres)
PITCH_WIDTH_M = 105.0
PITCH_HEIGHT_M = 68.0

# 32 FIFA standard pitch keypoints (destination points for homography, in metres).
# Origin is top-left corner of the pitch.
# Order matches the roboflow football-field-detection model keypoint order.
PITCH_KEYPOINTS_M = [
    (0.0, 0.0),       # 0  TL corner
    (52.5, 0.0),      # 1  TL halfway
    (105.0, 0.0),     # 2  TR corner
    (0.0, 13.84),     # 3  Left penalty area top-left
    (16.5, 13.84),    # 4  Left penalty area top-right
    (105.0, 13.84),   # 5  Right penalty area top-right (mirror)
    (88.5, 13.84),    # 6  Right penalty area top-left (mirror)
    (0.0, 24.84),     # 7  Left goal area top-left
    (5.5, 24.84),     # 8  Left goal area top-right
    (105.0, 24.84),   # 9  Right goal area top-right (mirror)
    (99.5, 24.84),    # 10 Right goal area top-left (mirror)
    (0.0, 34.0),      # 11 Left goal line mid
    (52.5, 34.0),     # 12 Centre spot
    (105.0, 34.0),    # 13 Right goal line mid
    (0.0, 43.16),     # 14 Left goal line mid (lower)
    (52.5, 43.16),    # 15 Centre circle bottom
    (105.0, 43.16),   # 16 Right goal line mid (lower)
    (0.0, 54.16),     # 17 Left goal area bottom-left
    (5.5, 54.16),     # 18 Left goal area bottom-right
    (105.0, 54.16),   # 19 Right goal area bottom-right (mirror)
    (99.5, 54.16),    # 20 Right goal area bottom-left (mirror)
    (0.0, 43.16),     # 21 Left penalty spot y
    (11.0, 34.0),     # 22 Left penalty spot
    (105.0, 43.16),   # 23 Right penalty spot y (mirror)
    (94.0, 34.0),     # 24 Right penalty spot (mirror)
    (0.0, 68.0),      # 25 BL corner
    (52.5, 68.0),     # 26 BL halfway
    (105.0, 68.0),    # 27 BR corner
    (0.0, 54.16),     # 28 Left penalty area bottom-left
    (16.5, 54.16),    # 29 Left penalty area bottom-right
    (105.0, 54.16),   # 30 Right penalty area bottom-right (mirror)
    (88.5, 54.16),    # 31 Right penalty area bottom-left (mirror)
]

# Class IDs expected from the player detection model
CLASS_PLAYER = 0
CLASS_GOALKEEPER = 1
CLASS_BALL = 2
CLASS_REFEREE = 3  # will be excluded from team assignment

# ---------------------------------------------------------------------------
# Helper: S3 meta update
# ---------------------------------------------------------------------------

def _make_update_meta(s3_client, job_id: str, results_bucket: str, base_meta: dict):
    """Return a closure that merges updates into base_meta and writes to S3."""

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
# Phase 2 helper: SigLIP embeddings + UMAP + KMeans team classification
# ---------------------------------------------------------------------------

def _classify_teams(all_crops: dict, device: str) -> dict:
    """
    Given a dict of {tracker_id: [crop_bgr, ...]}, return {tracker_id: team_id (0 or 1)}.

    Steps:
      1. For each player collect up to 5 recent crops.
      2. Embed each crop with SigLIP.
      3. Reduce all embeddings to 2-D with UMAP.
      4. Cluster with KMeans(n_clusters=2).
      5. Assign majority cluster label per tracker_id → team 0 or 1.
    """
    import torch
    import numpy as np
    from PIL import Image as PILImage
    from transformers import AutoProcessor, AutoModel
    from sklearn.cluster import KMeans
    from umap import UMAP

    # ---- collect samples ----
    tracker_ids = list(all_crops.keys())
    if len(tracker_ids) < 2:
        # Not enough players to classify — assign everyone to team 0
        return {tid: 0 for tid in tracker_ids}

    sample_crops = []  # flat list of (tracker_id, crop_rgb)
    for tid in tracker_ids:
        recent = all_crops[tid][-5:]  # up to 5 most recent crops
        for crop in recent:
            import cv2
            crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            sample_crops.append((tid, crop_rgb))

    if len(sample_crops) < 2:
        return {tid: 0 for tid in tracker_ids}

    # ---- SigLIP embeddings ----
    processor = AutoProcessor.from_pretrained(SIGLIP_MODEL_ID)
    model = AutoModel.from_pretrained(SIGLIP_MODEL_ID).to(device)
    model.eval()

    pil_images = [PILImage.fromarray(crop) for _, crop in sample_crops]

    # Process in batches to avoid OOM
    batch_size = 32
    embeddings = []
    with torch.no_grad():
        for i in range(0, len(pil_images), batch_size):
            batch = pil_images[i : i + batch_size]
            inputs = processor(images=batch, return_tensors="pt", padding=True).to(device)
            outputs = model.get_image_features(**inputs)
            embeddings.append(outputs.cpu().float().numpy())

    embeddings_np = np.vstack(embeddings)  # (N, D)

    # Normalize
    norms = np.linalg.norm(embeddings_np, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1.0, norms)
    embeddings_np = embeddings_np / norms

    # ---- UMAP reduction ----
    n_neighbors = min(15, len(embeddings_np) - 1)
    reducer = UMAP(n_components=2, n_neighbors=n_neighbors, random_state=42)
    reduced = reducer.fit_transform(embeddings_np)  # (N, 2)

    # ---- KMeans clustering ----
    km = KMeans(n_clusters=2, random_state=42, n_init=10)
    labels = km.fit_predict(reduced)

    # ---- Majority vote per tracker_id ----
    from collections import defaultdict, Counter
    tid_labels = defaultdict(list)
    for (tid, _), label in zip(sample_crops, labels):
        tid_labels[tid].append(label)

    team_assignments = {}
    for tid in tracker_ids:
        if tid in tid_labels:
            majority = Counter(tid_labels[tid]).most_common(1)[0][0]
            team_assignments[tid] = int(majority)
        else:
            team_assignments[tid] = 0

    return team_assignments


# ---------------------------------------------------------------------------
# Phase 3 helper: homography computation
# ---------------------------------------------------------------------------

def _compute_homography(src_pts, dst_pts_m):
    """
    Compute homography matrix from image keypoints to pitch coordinates.

    src_pts: list of (x_img, y_img)
    dst_pts_m: list of (x_m, y_m)  — real pitch coords in metres

    Returns H (3x3 numpy array) or None if not enough points.
    """
    import numpy as np
    import cv2

    if len(src_pts) < 4:
        return None

    src = np.array(src_pts, dtype=np.float32)
    dst = np.array(dst_pts_m, dtype=np.float32)
    H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
    return H


# ---------------------------------------------------------------------------
# Main pipeline function
# ---------------------------------------------------------------------------

@app.function(
    image=image,
    gpu="T4",
    timeout=10800,  # 3 hours
    secrets=[modal.Secret.from_name("aws-credentials"), modal.Secret.from_name("roboflow-credentials")],
)
def run_pipeline(job_id: str, video_s3_key: str, results_bucket: str):
    """Run the full CV pipeline for a single match video."""
    import cv2
    import numpy as np
    import supervision as sv
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    s3 = boto3.client("s3")

    # ---- fetch current meta to preserve existing fields ----
    try:
        obj = s3.get_object(Bucket=results_bucket, Key=f"jobs/{job_id}/meta.json")
        base_meta = json.loads(obj["Body"].read())
    except Exception:
        base_meta = {
            "id": job_id,
            "videoKey": video_s3_key,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

    current_progress = 0

    _update_meta_inner = _make_update_meta(s3, job_id, results_bucket, base_meta)

    def update_meta(status, progress, error=None, results_key=None):
        nonlocal current_progress
        current_progress = progress
        _update_meta_inner(status, progress, error=error, results_key=results_key)

    video_path = None

    try:
        # ==================================================================
        # Phase 0: Download video
        # ==================================================================
        update_meta("processing", 0)

        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
            video_path = f.name

        # Video and results share the same bucket (PITCHSCOUT_LAB_BUCKET on the Vercel side)
        s3.download_file(results_bucket, video_s3_key, video_path)
        update_meta("processing", 2)

        # ==================================================================
        # Phase 1: Load models
        # ==================================================================
        import traceback as _tb
        from ultralytics import YOLO as _YOLO
        import glob as _glob
        import shutil as _shutil

        # Clear any stale cached files from previous failed runs
        for _stale in ("/tmp/player_model.pt", "/tmp/keypoint_model.pt"):
            if os.path.exists(_stale):
                print(f"Removing stale file: {_stale}")
                os.unlink(_stale)
        for _stale_dir in ("/tmp/player_model", "/tmp/keypoint_model"):
            if os.path.isdir(_stale_dir):
                print(f"Removing stale dir: {_stale_dir}")
                _shutil.rmtree(_stale_dir)

        # Clear ultralytics model cache to force fresh download
        _yolo_cache = os.path.expanduser("~/.config/Ultralytics")
        if os.path.isdir(_yolo_cache):
            print(f"Ultralytics settings dir: {_yolo_cache}")
            for _f in _glob.glob(f"{_yolo_cache}/**/*.pt", recursive=True):
                print(f"  cached model: {_f}")

        print(f"Loading model: {PLAYER_MODEL_SRC}")
        try:
            player_model = _YOLO(PLAYER_MODEL_SRC)
        except Exception as _e:
            print(f"Model load error: {_e}")
            print(_tb.format_exc())
            raise

        print("Model loaded successfully")
        update_meta("processing", 5)

        # ==================================================================
        # Phase 1: Object detection + tracking (first pass)
        # ==================================================================
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        duration = total_frames / fps

        tracker = sv.ByteTrack()

        frames_raw = []       # [{frame_num, detections, ball_xy_img}]
        all_crops = {}        # {tracker_id: [crop_bgr, ...]}
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            frame_num += 1
            if frame_num % STRIDE != 0:
                continue

            # Player / ball detection
            results = player_model(frame, imgsz=1280, verbose=False)[0]
            detections = sv.Detections.from_ultralytics(results)

            # Remap COCO class IDs → pipeline class IDs
            # COCO: person=0, sports ball=32 → CLASS_PLAYER=0, CLASS_BALL=2
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

            # Extract ball position (take highest-confidence detection)
            ball_xy_img = None
            if detections.class_id is not None:
                ball_mask = detections.class_id == CLASS_BALL
                if ball_mask.any():
                    ball_dets = detections[ball_mask]
                    best = int(np.argmax(ball_dets.confidence))
                    bx1, by1, bx2, by2 = ball_dets.xyxy[best]
                    ball_xy_img = (float((bx1 + bx2) / 2), float((by1 + by2) / 2))

            # Collect player data
            player_entries = []
            if detections.tracker_id is not None:
                for i in range(len(detections)):
                    tid = detections.tracker_id[i]
                    cid = detections.class_id[i] if detections.class_id is not None else -1
                    if tid is None:
                        continue
                    if cid not in (CLASS_PLAYER, CLASS_GOALKEEPER):
                        continue

                    x1, y1, x2, y2 = map(int, detections.xyxy[i])
                    cx = float((x1 + x2) / 2)
                    cy = float((y1 + y2) / 2)

                    # Collect crops for team classification (every 30 sampled frames)
                    if len(frames_raw) % (30 // STRIDE + 1) == 0:
                        crop = frame[max(0, y1) : y2, max(0, x1) : x2]
                        if crop.size > 0:
                            all_crops.setdefault(int(tid), []).append(crop)

                    player_entries.append(
                        {
                            "id": int(tid),
                            "role": "goalkeeper" if cid == CLASS_GOALKEEPER else "player",
                            "img_cx": cx,
                            "img_cy": cy,
                        }
                    )

            frames_raw.append(
                {
                    "frame_num": frame_num,
                    "t": frame_num / fps,
                    "players": player_entries,
                    "ball_xy_img": ball_xy_img,
                }
            )

            # Progress: 5–45%
            if len(frames_raw) % 50 == 0:
                pct = 5 + int((frame_num / total_frames) * 40)
                update_meta("processing", pct)

        cap.release()
        update_meta("processing", 45)

        # ==================================================================
        # Phase 2: Team classification (SigLIP + UMAP + KMeans)
        # ==================================================================
        team_assignments = _classify_teams(all_crops, device)
        update_meta("processing", 60)

        # ==================================================================
        # Phase 3: Keypoint detection + homography
        # Pitch keypoint model not yet available — homography disabled.
        # All pitch_x/pitch_y values will be None; stats still work.
        # ==================================================================
        update_meta("processing", 75)

        def _get_H_for_frame(_fn):
            return None

        # ==================================================================
        # Phase 4: Aggregate results
        # ==================================================================
        frames_data = []
        ball_positions_pitch = []  # [[px, py], ...] for trajectory
        team_ball_frames = {0: 0, 1: 0}  # possession counting
        player_distances = {}   # {tracker_id: {"team": t, "metres": float}}
        player_last_pos = {}    # {tracker_id: (px, py)}
        team_territory = {0: 0.0, 1: 0.0}  # sum of x positions for territory

        for fr in frames_raw:
            fn = fr["frame_num"]
            t = fr["t"]
            H = _get_H_for_frame(fn)

            frame_players = []
            frame_team_positions = {0: [], 1: []}

            for p in fr["players"]:
                tid = p["id"]
                team = team_assignments.get(tid, 0)
                role = p["role"]

                if H is not None:
                    try:
                        import cv2 as _cv2
                        pt = np.array([[[p["img_cx"], p["img_cy"]]]], dtype=np.float32)
                        out = _cv2.perspectiveTransform(pt, H)
                        pitch_x = float(np.clip(out[0][0][0], 0.0, PITCH_WIDTH_M))
                        pitch_y = float(np.clip(out[0][0][1], 0.0, PITCH_HEIGHT_M))
                    except Exception:
                        pitch_x = pitch_y = None
                else:
                    pitch_x = pitch_y = None

                frame_players.append(
                    {
                        "id": tid,
                        "team": team,
                        "role": role,
                        "pitch_x": pitch_x,
                        "pitch_y": pitch_y,
                    }
                )

                if pitch_x is not None and pitch_y is not None:
                    frame_team_positions[team].append((pitch_x, pitch_y))
                    team_territory[team] += pitch_x  # crude territory metric

                    # Distance accumulation
                    if tid in player_last_pos:
                        lx, ly = player_last_pos[tid]
                        d = ((pitch_x - lx) ** 2 + (pitch_y - ly) ** 2) ** 0.5
                        # Scale: each frame is STRIDE frames apart
                        player_distances.setdefault(tid, {"team": team, "metres": 0.0})
                        player_distances[tid]["metres"] += d
                    player_last_pos[tid] = (pitch_x, pitch_y)

            # Ball pitch position
            ball_pitch = None
            if fr["ball_xy_img"] and H is not None:
                try:
                    bx, by = fr["ball_xy_img"]
                    pt = np.array([[[bx, by]]], dtype=np.float32)
                    out = cv2.perspectiveTransform(pt, H)
                    bpx = float(np.clip(out[0][0][0], 0.0, PITCH_WIDTH_M))
                    bpy = float(np.clip(out[0][0][1], 0.0, PITCH_HEIGHT_M))
                    ball_pitch = {"pitch_x": bpx, "pitch_y": bpy}
                    ball_positions_pitch.append([bpx, bpy])

                    # Possession: assign to nearest team
                    nearest_team = None
                    nearest_dist = float("inf")
                    for team_id, positions in frame_team_positions.items():
                        for (px2, py2) in positions:
                            d = ((bpx - px2) ** 2 + (bpy - py2) ** 2) ** 0.5
                            if d < nearest_dist:
                                nearest_dist = d
                                nearest_team = team_id
                    if nearest_team is not None and nearest_dist < 5.0:  # within 5m
                        team_ball_frames[nearest_team] += 1
                except Exception:
                    pass

            frames_data.append(
                {
                    "t": round(t, 3),
                    "players": frame_players,
                    "ball": ball_pitch,
                }
            )

        update_meta("processing", 88)

        # ---- Compute stats ----
        total_ball_frames = sum(team_ball_frames.values()) or 1
        possession = [
            round(team_ball_frames[0] / total_ball_frames * 100, 1),
            round(team_ball_frames[1] / total_ball_frames * 100, 1),
        ]

        distances_list = [
            {"id": tid, "team": info["team"], "metres": round(info["metres"], 1)}
            for tid, info in player_distances.items()
        ]
        distances_list.sort(key=lambda x: x["metres"], reverse=True)

        total_territory = sum(team_territory.values()) or 1.0
        territory = [
            round(team_territory[0] / total_territory * 100, 1),
            round(team_territory[1] / total_territory * 100, 1),
        ]

        results = {
            "meta": {
                "fps": round(fps / STRIDE, 3),
                "duration": round(duration, 2),
                "frameCount": len(frames_data),
            },
            "frames": frames_data,
            "trajectory": ball_positions_pitch,
            "stats": {
                "possession": possession,
                "distances": distances_list,
                "territory": territory,
            },
        }

        # ---- Write gzip-compressed results to S3 ----
        import gzip

        results_key = f"jobs/{job_id}/results.json"
        body = gzip.compress(json.dumps(results).encode("utf-8"))
        s3.put_object(
            Bucket=results_bucket,
            Key=results_key,
            Body=body,
            ContentType="application/json",
            ContentEncoding="gzip",
        )

        update_meta("done", 100, results_key=results_key)

    except Exception as exc:
        update_meta("error", current_progress, error=str(exc))
        raise

    finally:
        if video_path and os.path.exists(video_path):
            os.unlink(video_path)


# ---------------------------------------------------------------------------
# Non-blocking web endpoint
# ---------------------------------------------------------------------------

trigger_image = modal.Image.debian_slim().pip_install("fastapi[standard]>=0.100", "boto3>=1.34")

@app.function(image=trigger_image, secrets=[modal.Secret.from_name("aws-credentials")])
@modal.fastapi_endpoint(method="POST")
def trigger(body: dict):
    """
    Non-blocking HTTP POST endpoint.

    Body (JSON):
        job_id         str   — unique job identifier
        video_s3_key   str   — S3 key of the uploaded video
        results_bucket str   — S3 bucket for meta.json + results.json

    Returns immediately; pipeline runs asynchronously on a GPU worker.
    """
    job_id = body.get("job_id")
    video_s3_key = body.get("video_s3_key")
    results_bucket = body.get("results_bucket")

    if not all([job_id, video_s3_key, results_bucket]):
        return {"error": "Missing required fields: job_id, video_s3_key, results_bucket"}

    run_pipeline.spawn(
        job_id=job_id,
        video_s3_key=video_s3_key,
        results_bucket=results_bucket,
    )

    return {"ok": True, "job_id": job_id}
