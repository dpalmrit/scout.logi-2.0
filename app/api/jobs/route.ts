import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listJobsForUser } from '@/lib/s3'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const jobs = await listJobsForUser(session.user.email)
    // listJobsForUser already sorts by createdAt descending
    return NextResponse.json(jobs)
  } catch {
    return NextResponse.json({ error: 'Failed to list jobs' }, { status: 500 })
  }
}
