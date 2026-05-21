import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LabPage() {
  const session = await getServerSession(authOptions)
  redirect(session ? '/lab/dashboard' : '/lab/login')
}
