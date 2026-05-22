'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CircleNotch } from '@phosphor-icons/react'
import type { Results } from '@/lib/types'
import RadarCanvas from '@/app/components/lab/RadarCanvas'
import VoronoiView from '@/app/components/lab/VoronoiView'
import TrajectoryView from '@/app/components/lab/TrajectoryView'
import StatsPanel from '@/app/components/lab/StatsPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'radar' | 'voronoi' | 'trajectory' | 'stats'

type VizProps = {
  results: Results
  frameIdx: number
  onFrameChange: (idx: number) => void
}

// ---------------------------------------------------------------------------
// Stub visualisation components (Tasks 10-13 will replace these)
// ---------------------------------------------------------------------------

function RadarStub({ results, frameIdx, onFrameChange }: VizProps) {
  return (
    <div className="flex items-center justify-center h-64 rounded-xl border border-[#1a2e1f] bg-[#0d1f12]">
      <p className="text-gray-400 text-sm">Radar view — coming soon</p>
      {/* RadarCanvas will replace this in Task 10 */}
    </div>
  )
}

function VoronoiStub({ results, frameIdx, onFrameChange }: VizProps) {
  return (
    <div className="flex items-center justify-center h-64 rounded-xl border border-[#1a2e1f] bg-[#0d1f12]">
      <p className="text-gray-400 text-sm">Voronoi view — coming soon</p>
      {/* VoronoiView will replace this in Task 11 */}
    </div>
  )
}

function TrajectoryStub({ results, frameIdx, onFrameChange }: VizProps) {
  return (
    <div className="flex items-center justify-center h-64 rounded-xl border border-[#1a2e1f] bg-[#0d1f12]">
      <p className="text-gray-400 text-sm">Trajectory view — coming soon</p>
      {/* TrajectoryView will replace this in Task 12 */}
    </div>
  )
}

function StatsStub({ results, frameIdx, onFrameChange }: VizProps) {
  return (
    <div className="flex items-center justify-center h-64 rounded-xl border border-[#1a2e1f] bg-[#0d1f12]">
      <p className="text-gray-400 text-sm">Stats panel — coming soon</p>
      {/* StatsPanel will replace this in Task 13 */}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tabs config
// ---------------------------------------------------------------------------

const TABS: { id: Tab; label: string }[] = [
  { id: 'radar', label: 'Radar' },
  { id: 'voronoi', label: 'Voronoi' },
  { id: 'trajectory', label: 'Trajectory' },
  { id: 'stats', label: 'Stats' },
]

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ResultsPage({
  params,
}: {
  params: { jobId: string }
}) {
  // TODO: Next.js 15 — params becomes Promise<{jobId:string}>; replace with use(params) from React 19
  const { jobId } = params

  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notReady, setNotReady] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('radar')
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        // Step 1 — get the presigned S3 URL
        const urlRes = await fetch(`/api/jobs/${jobId}/results-url`, {
          cache: 'no-store',
        })

        if (cancelled) return

        if (urlRes.status === 409) {
          setNotReady(true)
          setLoading(false)
          return
        }

        if (urlRes.status === 401) {
          setError('You must be signed in to view this analysis.')
          setLoading(false)
          return
        }

        if (urlRes.status === 403) {
          setError('You do not have permission to view this analysis.')
          setLoading(false)
          return
        }

        if (urlRes.status === 404) {
          setError('Analysis not found.')
          setLoading(false)
          return
        }

        if (!urlRes.ok) {
          setError(`Unexpected error loading results (${urlRes.status}).`)
          setLoading(false)
          return
        }

        const { url } = (await urlRes.json()) as { url: string }

        // Step 2 — fetch results.json from presigned S3 URL
        const dataRes = await fetch(url)
        if (cancelled) return

        if (!dataRes.ok) {
          setError(`Failed to fetch results data (${dataRes.status}).`)
          setLoading(false)
          return
        }

        const data = (await dataRes.json()) as Results
        if (!cancelled) {
          setResults(data)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load results.')
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [jobId])

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderTabContent() {
    if (!results) return null
    const vizProps: VizProps = {
      results,
      frameIdx,
      onFrameChange: setFrameIdx,
    }
    switch (activeTab) {
      case 'radar':
        return <RadarCanvas {...vizProps} />
      case 'voronoi':
        return <VoronoiView {...vizProps} />
      case 'trajectory':
        return <TrajectoryView {...vizProps} />
      case 'stats':
        return <StatsPanel {...vizProps} />
    }
  }

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  return (
    <main className="min-h-screen bg-[#080f0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-10 flex flex-col gap-8">

        {/* Header */}
        <header className="flex items-center gap-4">
          <Link
            href="/lab/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} weight="bold" />
            back to Dashboard
          </Link>
          <span className="text-[#1a2e1f]">|</span>
          <h1 className="text-xl font-bold tracking-tight text-white">
            PitchScout Lab — Analysis
          </h1>
        </header>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <CircleNotch size={32} className="text-[#00e676] animate-spin" weight="bold" />
          </div>
        )}

        {/* Not ready (409) */}
        {!loading && notReady && (
          <div className="rounded-xl border border-[#1a2e1f] bg-[#0d1f12] px-6 py-12 text-center flex flex-col items-center gap-4">
            <p className="text-white/70 text-base">
              Analysis in progress — check back later
            </p>
            <Link
              href="/lab/dashboard"
              className="text-sm text-[#00e676] hover:underline"
            >
              ← back to Dashboard
            </Link>
          </div>
        )}

        {/* Error */}
        {!loading && !notReady && error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 flex flex-col gap-3">
            <p className="text-red-400 text-sm">{error}</p>
            <Link
              href="/lab/dashboard"
              className="text-sm text-[#00e676] hover:underline self-start"
            >
              ← back to Dashboard
            </Link>
          </div>
        )}

        {/* Results */}
        {!loading && !notReady && !error && results && (
          <div className="flex flex-col gap-6">

            {/* Tab bar */}
            <nav className="flex gap-0 border-b border-[#1a2e1f]">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={[
                      'px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                      isActive
                        ? 'text-[#00e676] border-[#00e676]'
                        : 'text-gray-400 border-transparent hover:text-white',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            {/* Tab content panel */}
            <div className="rounded-xl border border-[#1a2e1f] bg-[#0d1f12] p-4">
              {renderTabContent()}
            </div>

            {/* Scrubber — shown for radar + voronoi tabs */}
            {(activeTab === 'radar' || activeTab === 'voronoi') &&
              results.frames.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Frame scrubber</span>
                    <span className="font-mono text-white">
                      {results.frames[frameIdx]?.t.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={results.frames.length - 1}
                    value={frameIdx}
                    onChange={(e) => setFrameIdx(Number(e.target.value))}
                    className="w-full accent-[#00e676] cursor-pointer"
                  />
                </div>
              )}
          </div>
        )}

      </div>
    </main>
  )
}
