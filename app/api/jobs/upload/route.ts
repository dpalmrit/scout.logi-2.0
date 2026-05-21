import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { putJob, presignedPutUrl } from '@/lib/s3'
import type { Job } from '@/lib/types'
import { nanoid } from 'nanoid'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { filename?: string; contentType?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { filename, contentType } = body
  if (!filename) {
    return NextResponse.json({ error: 'filename is required' }, { status: 400 })
  }

  const jobId = nanoid()
  const videoKey = `jobs/${jobId}/video/${filename}`

  let uploadUrl: string
  try {
    uploadUrl = await presignedPutUrl(videoKey, contentType ?? 'application/octet-stream')
  } catch (err) {
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }

  const job: Job = {
    id: jobId,
    userId: session.user.email,
    filename,
    videoKey,
    status: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
  }

  try {
    await putJob(job)
  } catch {
    return NextResponse.json({ error: 'Failed to create job' }, { status: 500 })
  }

  return NextResponse.json({ jobId, uploadUrl })
}
