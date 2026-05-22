'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock, CheckCircle, Warning, Spinner, X, Prohibit } from '@phosphor-icons/react'
import type { Job } from '@/lib/types'

interface JobCardProps {
  job: Job
}

function relativeTime(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return `${m} minute${m === 1 ? '' : 's'} ago`
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const d = Math.floor(diff / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

export default function JobCard({ job: initialJob }: JobCardProps) {
  const [job, setJob] = useState<Job>(initialJob)
  const [cancelling, setCancelling] = useState(false)

  // Keep local state in sync when parent re-renders with fresh data
  useEffect(() => {
    setJob(initialJob)
  }, [initialJob])

  useEffect(() => {
    if (job.status !== 'processing') return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data: { status: Job['status']; progress: number; error?: string } = await res.json()
        setJob((prev) => ({
          ...prev,
          status: data.status,
          progress: data.progress,
          error: data.error,
        }))
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(interval)
        }
      } catch {
        // silently ignore transient network errors
      }
    }, 10_000)

    return () => clearInterval(interval)
  }, [job.id, job.status])

  async function handleCancel() {
    setCancelling(true)
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: 'DELETE' })
      if (res.ok) {
        setJob((prev) => ({ ...prev, status: 'cancelled' }))
      }
    } catch {
      // silently ignore
    } finally {
      setCancelling(false)
    }
  }

  const statusBadge = () => {
    switch (job.status) {
      case 'queued':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/60 text-xs font-medium">
            <Clock size={12} weight="bold" />
            Queued
          </span>
        )
      case 'processing':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">
            <Spinner size={12} weight="bold" className="animate-spin" />
            Processing
          </span>
        )
      case 'done':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00e676]/15 text-[#00e676] text-xs font-medium">
            <CheckCircle size={12} weight="bold" />
            Done
          </span>
        )
      case 'error':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 text-xs font-medium">
            <Warning size={12} weight="bold" />
            Error
          </span>
        )
      case 'cancelled':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-white/40 text-xs font-medium">
            <Prohibit size={12} weight="bold" />
            Cancelled
          </span>
        )
    }
  }

  return (
    <div className="rounded-xl border border-[#1a2e1f] bg-[#0d1f12] p-5 flex flex-col gap-3 hover:border-[#00e676]/30 transition-colors">
      {/* Top row: filename + badge */}
      <div className="flex items-start justify-between gap-3">
        <p className="text-white font-medium text-sm truncate flex-1" title={job.filename}>
          {job.filename}
        </p>
        <div className="shrink-0">{statusBadge()}</div>
      </div>

      {/* Progress bar for processing state */}
      {job.status === 'processing' && (
        <div className="flex flex-col gap-1.5">
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all duration-500"
              style={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="text-amber-400/70 text-xs tabular-nums">{job.progress}% complete</p>
        </div>
      )}

      {/* Error text */}
      {job.status === 'error' && job.error && (
        <p className="text-red-400/80 text-xs bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
          {job.error}
        </p>
      )}

      {/* Footer row: time + actions */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="text-white/30 text-xs">{relativeTime(job.createdAt)}</span>
        <div className="flex items-center gap-3">
          {(job.status === 'queued' || job.status === 'processing') && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="flex items-center gap-1 text-white/30 text-xs hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <X size={12} weight="bold" />
              {cancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          )}
          {job.status === 'done' && (
            <Link
              href={`/lab/results/${job.id}`}
              className="flex items-center gap-1 text-[#00e676] text-xs font-medium hover:underline"
            >
              View Results <ArrowRight size={12} weight="bold" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
