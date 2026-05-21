export async function triggerPipeline(
  jobId: string,
  videoKey: string,
  bucket: string
): Promise<void> {
  const url = process.env.MODAL_TRIGGER_URL
  if (!url) throw new Error('MODAL_TRIGGER_URL env var not set')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, video_s3_key: videoKey, results_bucket: bucket }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Modal trigger failed ${res.status}: ${text}`)
  }
}
