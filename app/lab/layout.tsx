import SessionWrapper from '@/app/components/lab/SessionWrapper'

export const dynamic = 'force-dynamic'

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <SessionWrapper>{children}</SessionWrapper>
}
