import LoginButton from '@/app/components/lab/LoginButton'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const denied = searchParams.error === 'AccessDenied'

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080f0a]">
      <div className="border border-[#00e676]/20 rounded-2xl p-10 flex flex-col items-center gap-6 w-full max-w-sm bg-[#0d1f12]">
        <div className="text-center">
          <h1 className="text-white font-bold text-2xl tracking-tight">PitchScout Lab</h1>
          <p className="text-white/40 text-sm mt-1">Private research access</p>
        </div>
        {denied && (
          <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 w-full">
            This Google account does not have access. Contact the admin.
          </p>
        )}
        <LoginButton />
        <p className="text-white/20 text-xs text-center">Access restricted to approved accounts only</p>
      </div>
    </main>
  )
}
