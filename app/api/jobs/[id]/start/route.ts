import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob, putJob } from '@/lib/s3'
import { triggerPipeline } from '@/lib/modal'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const job = await getJob(params.id)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  if (job.userId !== session.user.email) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (job.status !== 'queued') {
    return NextResponse.json({ error: 'Job already started' }, { status: 409 })
  }

  await putJob({ ...job, status: 'processing' })

  try {
    await triggerPipeline(job.id, job.videoKey, process.env.PITCHSCOUT_LAB_BUCKET!)
  } catch {
    // Revert status on pipeline trigger failure
    await putJob({ ...job, status: 'queued' })
    return NextResponse.json({ error: 'Pipeline trigger failed' }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
