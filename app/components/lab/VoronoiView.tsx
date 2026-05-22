'use client'

import { Delaunay } from 'd3-delaunay'
import type { Results } from '@/lib/types'

type VizProps = {
  results: Results
  frameIdx: number
  onFrameChange: (idx: number) => void
}

// Canvas logical size — 10px per metre (105m × 68m pitch)
const CW = 1050
const CH = 680

// ---------------------------------------------------------------------------
// Pitch line elements (SVG equivalents of the canvas pitch in RadarCanvas)
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
      {/* Top-left: arc from 0° to 90° */}
      <path d="M 10 0 A 10 10 0 0 1 0 10" />
      {/* Top-right: arc from 90° to 180° */}
      <path d={`M ${CW - 10} 0 A 10 10 0 0 0 ${CW} 10`} />
      {/* Bottom-left: arc from 270° to 360° */}
      <path d={`M 0 ${CH - 10} A 10 10 0 0 1 10 ${CH}`} />
      {/* Bottom-right: arc from 180° to 270° */}
      <path d={`M ${CW - 10} ${CH} A 10 10 0 0 1 ${CW} ${CH - 10}`} />
    </g>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VoronoiView({ results, frameIdx }: VizProps) {
  const frame = results.frames[frameIdx]

  // Filter to players only (exclude referees for cleaner territory view)
  const players = frame
    ? frame.players.filter((p) => p.role !== 'referee')
    : []

  // All players including referees for rendering dots
  const allPlayers = frame ? frame.players : []

  // ---------------------------------------------------------------------------
  // Voronoi computation
  // ---------------------------------------------------------------------------

  type PointEntry = {
    x: number
    y: number
    team: 0 | 1
    role: 'player' | 'goalkeeper' | 'referee'
    id: number
    idx: number
  }

  const points: PointEntry[] = players.map((p, i) => ({
    x: p.pitch_x * 10,
    y: p.pitch_y * 10,
    team: p.team,
    role: p.role,
    id: p.id,
    idx: i,
  }))

  let cellPaths: Array<{ d: string; team: 0 | 1 }> = []

  if (points.length >= 3) {
    try {
      const delaunay = Delaunay.from(points, (p) => p.x, (p) => p.y)
      const voronoi = delaunay.voronoi([0, 0, CW, CH])

      cellPaths = points.map((p, i) => ({
        d: voronoi.renderCell(i),
        team: p.team,
      }))
    } catch {
      // If Delaunay fails (e.g. all points collinear), skip cells
      cellPaths = []
    }
  }

  // ---------------------------------------------------------------------------
  // Territory bar values
  // ---------------------------------------------------------------------------

  const [t0, t1] = results.stats.territory
  const pct0 = Math.round(t0)
  const pct1 = Math.round(t1)

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3">
      {/* SVG pitch */}
      <svg
        viewBox={`0 0 ${CW} ${CH}`}
        width="100%"
        style={{ height: 'auto', display: 'block' }}
        aria-label="Voronoi territory diagram"
      >
        {/* Pitch background */}
        <rect width={CW} height={CH} fill="#0d1f12" />

        {/* Voronoi cells (rendered below pitch lines) */}
        {cellPaths.map((cell, i) => (
          <path
            key={i}
            d={cell.d}
            fill={
              cell.team === 0
                ? 'rgba(0, 230, 118, 0.2)'
                : 'rgba(255, 82, 82, 0.2)'
            }
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={0.5}
          />
        ))}

        {/* Pitch markings */}
        <PitchLines />

        {/* Ball */}
        {frame?.ball && (
          <g>
            <circle
              cx={frame.ball.pitch_x * 10}
              cy={frame.ball.pitch_y * 10}
              r={6}
              fill="#ffffff"
            />
            <circle
              cx={frame.ball.pitch_x * 10}
              cy={frame.ball.pitch_y * 10}
              r={8}
              fill="none"
              stroke="rgba(150,150,150,0.8)"
              strokeWidth={2}
            />
          </g>
        )}

        {/* Player dots */}
        {allPlayers.map((player) => {
          const cx = player.pitch_x * 10
          const cy = player.pitch_y * 10
          const isRef = player.role === 'referee'
          const color = isRef
            ? '#ffeb3b'
            : player.team === 0
            ? '#00e676'
            : '#ff5252'
          const r = isRef ? 6 : 8
          const alpha = isRef ? 1 : player.role === 'goalkeeper' ? 0.9 : 0.7

          return (
            <g key={player.id}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                opacity={alpha}
              />
              <text
                x={cx}
                y={cy}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={10}
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {player.id}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Territory bar */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-gray-400 font-mono">
          <span>Team 0 — {pct0}%</span>
          <span>Team 1 — {pct1}%</span>
        </div>
        <div className="flex w-full h-3 rounded overflow-hidden">
          <div
            style={{ width: `${pct0}%` }}
            className="bg-[#00e676] bg-opacity-60 transition-all duration-300"
          />
          <div
            style={{ width: `${pct1}%` }}
            className="bg-[#ff5252] bg-opacity-60 transition-all duration-300"
          />
        </div>
      </div>
    </div>
  )
}
