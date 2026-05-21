import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob, presignedGetUrl } from '@/lib/s3'

export async function GET(
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

  if (job.status !== 'done') {
    return NextResponse.json({ error: 'Results not ready' }, { status: 409 })
  }

  const resultsKey = job.resultsKey ?? `jobs/${job.id}/results.json`
  const url = await presignedGetUrl(resultsKey)

  return NextResponse.json({ url })
}
