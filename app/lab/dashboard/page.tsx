'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { SignOut, CircleNotch } from '@phosphor-icons/react'
import type { Job } from '@/lib/types'
import UploadZone from '@/app/components/lab/UploadZone'
import JobCard from '@/app/components/lab/JobCard'

const POLL_INTERVAL = 30_000

function sortJobs(jobs: Job[]): Job[] {
  return [...jobs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs', { cache: 'no-store' })
      if (!res.ok) throw new Error(`Failed to load jobs (${res.status})`)
      const data: Job[] = await res.json()
      setJobs(sortJobs(data))
      setFetchError(null)
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load analyses')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + periodic refresh
  useEffect(() => {
    fetchJobs()
    intervalRef.current = setInterval(fetchJobs, POLL_INTERVAL)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchJobs])

  const handleUploadComplete = useCallback(
    (jobId: string) => {
      // Immediate refresh so the new job appears at the top
      void fetchJobs()
      // Also reset the periodic timer so we don't double-poll too quickly
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(fetchJobs, POLL_INTERVAL)
    },
    [fetchJobs]
  )

  return (
    <main className="min-h-screen bg-[#080f0a] text-white">
      <div className="max-w-3xl mx-auto px-4 py-10 flex flex-col gap-10">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight text-white">PitchScout Lab</h1>
          <button
            onClick={() => signOut({ callbackUrl: '/lab/login' })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1a2e1f] text-white/50 text-sm hover:text-white hover:border-[#00e676]/40 transition-colors"
          >
            <SignOut size={16} weight="bold" />
            Sign out
          </button>
        </header>

        {/* Upload Zone */}
        <section>
          <UploadZone onUploadComplete={handleUploadComplete} />
        </section>

        {/* Job List */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-white/70 tracking-wide uppercase text-xs">
            Your Analyses
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-16">
              <CircleNotch size={28} className="text-[#00e676] animate-spin" weight="bold" />
            </div>
          )}

          {!loading && fetchError && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-red-400 text-sm">
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && jobs.length === 0 && (
            <div className="rounded-xl border border-[#1a2e1f] bg-[#0d1f12] px-6 py-12 text-center">
              <p className="text-white/30 text-sm">
                No analyses yet. Upload a match video to get started.
              </p>
            </div>
          )}

          {!loading && !fetchError && jobs.length > 0 && (
            <div className="flex flex-col gap-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
