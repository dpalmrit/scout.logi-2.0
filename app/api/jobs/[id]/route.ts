import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob, putJob } from '@/lib/s3'

export async function DELETE(
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

  if (job.status === 'done' || job.status === 'cancelled') {
    return NextResponse.json({ error: 'Job already finished' }, { status: 409 })
  }

  await putJob({ ...job, status: 'cancelled' })

  return NextResponse.json({ ok: true })
}
