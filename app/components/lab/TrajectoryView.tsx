'use client'

import type { VizProps } from '@/lib/types'

// Canvas logical size — 10px per metre (105m × 68m pitch)
const CW = 1050
const CH = 680

// ---------------------------------------------------------------------------
// Pitch line elements (matching VoronoiView style)
// ---------------------------------------------------------------------------

function PitchLines() {
  const s = 'rgba(255,255,255,0.3)'
  const sw = 2

  return (
    <g stroke={s} strokeWidth={sw} fill="none">
      {/* Outer rectangle */}
      <rect x={0} y={0} width={CW} height={CH} />

      {/* Centre line */}
      <line x1={525} y1={0} x2={525} y2={CH} />

      {/* Centre circle */}
      <circle cx={525} cy={340} r={91.5} />

      {/* Centre spot */}
      <circle cx={525} cy={340} r={5} fill={s} />

      {/* Penalty areas */}
      <rect x={0} y={137.5} width={165} height={405} />
      <rect x={885} y={137.5} width={165} height={405} />

      {/* Goal areas (6-yard boxes) */}
      <rect x={0} y={240.5} width={55} height={199} />
      <rect x={995} y={240.5} width={55} height={199} />

      {/* Goals */}
      <rect x={0} y={302.5} width={10} height={75} fill="rgba(255,255,255,0.15)" />
      <rect x={1040} y={302.5} width={10} height={75} fill="rgba(255,255,255,0.15)" />

      {/* Corner arcs (quarter-circles, r=10) */}
      <path d="M 10 0 A 10 10 0 0 1 0 10" />
      <path d={`M ${CW - 10} 0 A 10 10 0 0 0 ${CW} 10`} />
      <path d={`M 0 ${CH - 10} A 10 10 0 0 1 10 ${CH}`} />
      <path d={`M ${CW - 10} ${CH} A 10 10 0 0 1 ${CW} ${CH - 10}`} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TrajectoryView({ results, frameIdx, onFrameChange }: VizProps) {
  const { trajectory } = results

  // Downsample for performance: keep ~500 points max
  const step = Math.max(1, Math.floor(trajectory.length / 500))
  const sampled: Array<{ x: number; y: number; origIdx: number }> = []
  for (let i = 0; i < trajectory.length; i += step) {
    sampled.push({
      x: trajectory[i][0] * 10,
      y: trajectory[i][1] * 10,
      origIdx: i,
    })
  }

  // Current frame position (if in bounds)
  const currentPoint =
    frameIdx >= 0 && frameIdx < trajectory.length
      ? { x: trajectory[frameIdx][0] * 10, y: trajectory[frameIdx][1] * 10 }
      : null

  // Start and end dots from original (un-downsampled) array
  const startPt = trajectory.length > 0
    ? { x: trajectory[0][0] * 10, y: trajectory[0][1] * 10 }
    : null
  const endPt = trajectory.length > 0
    ? { x: trajectory[trajectory.length - 1][0] * 10, y: trajectory[trajectory.length - 1][1] * 10 }
    : null

  // ---------------------------------------------------------------------------
  // Click-to-seek: find nearest trajectory point to click position
  // ---------------------------------------------------------------------------

  function handleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (trajectory.length === 0) return

    const rect = e.currentTarget.getBoundingClientRect()
    // Convert click coords to SVG viewBox space
    const svgX = ((e.clientX - rect.left) / rect.width) * CW
    const svgY = ((e.clientY - rect.top) / rect.height) * CH

    let nearestIdx = 0
    let minDist = Infinity

    for (let i = 0; i < trajectory.length; i++) {
      const tx = trajectory[i][0] * 10
      const ty = trajectory[i][1] * 10
      const dx = tx - svgX
      const dy = ty - svgY
      const dist = dx * dx + dy * dy // skip sqrt for perf
      if (dist < minDist) {
        minDist = dist
        nearestIdx = i
      }
    }

    onFrameChange(nearestIdx)
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const total = sampled.length

  return (
    <svg
      viewBox={`0 0 ${CW} ${CH}`}
      width="100%"
      style={{ display: 'block', cursor: trajectory.length > 0 ? 'crosshair' : 'default' }}
      onClick={handleClick}
      aria-label="Ball trajectory path"
    >
      {/* Pitch background */}
      <rect width={CW} height={CH} fill="#0d1f12" />

      {/* Pitch markings */}
      <PitchLines />

      {/* Trajectory line segments with fading opacity */}
      {sampled.length > 1 &&
        sampled.slice(0, -1).map((pt, i) => {
          const next = sampled[i + 1]
          const denom = total > 1 ? total - 1 : 1
          const opacity = (i / denom) * 0.9 + 0.1
          return (
            <line
              key={i}
              x1={pt.x}
              y1={pt.y}
              x2={next.x}
              y2={next.y}
              stroke="#ffffff"
              strokeWidth={2}
              opacity={opacity}
              strokeLinecap="round"
            />
          )
        })}

      {/* Start dot — blue-gray */}
      {startPt && (
        <circle cx={startPt.x} cy={startPt.y} r={6} fill="#90caf9" />
      )}

      {/* End dot — bright white with green ring */}
      {endPt && (
        <circle
          cx={endPt.x}
          cy={endPt.y}
          r={8}
          fill="#ffffff"
          stroke="#00e676"
          strokeWidth={2}
        />
      )}

      {/* Current frame marker — green */}
      {currentPoint && (
        <circle
          cx={currentPoint.x}
          cy={currentPoint.y}
          r={10}
          fill="rgba(0,230,118,0.6)"
          stroke="#00e676"
          strokeWidth={2}
        />
      )}
    </svg>
  )
}
