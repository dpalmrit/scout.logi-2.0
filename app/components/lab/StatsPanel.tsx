'use client'

import type { VizProps } from '@/lib/types'

export default function StatsPanel({ results }: VizProps) {
  const { possession, distances, territory } = results.stats

  const totalKm = distances.reduce((s, d) => s + d.metres, 0) / 1000
  const playersTracked = distances.length

  const sorted = [...distances].sort((a, b) => b.metres - a.metres)

  return (
    <div className="flex flex-col gap-8">

      {/* Section 1: Stat Cards */}
      <div className="grid grid-cols-2 gap-4">

        {/* Possession */}
        <div className="bg-[#0d1f12] border border-[#1a2e1f] rounded-xl p-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Possession</p>
          <p className="text-white text-xl font-bold">
            {possession[0].toFixed(0)}% — {possession[1].toFixed(0)}%
          </p>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#00e676]"
              style={{ width: `${possession[0]}%` }}
            />
            <div
              className="bg-[#ff5252] flex-1"
            />
          </div>
        </div>

        {/* Total Distance */}
        <div className="bg-[#0d1f12] border border-[#1a2e1f] rounded-xl p-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Total Distance</p>
          <p className="text-[#00e676] text-xl font-bold">
            {totalKm.toFixed(1)} km
          </p>
        </div>

        {/* Players Tracked */}
        <div className="bg-[#0d1f12] border border-[#1a2e1f] rounded-xl p-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Players Tracked</p>
          <p className="text-[#00e676] text-xl font-bold">
            {playersTracked}
          </p>
        </div>

        {/* Territory Control */}
        <div className="bg-[#0d1f12] border border-[#1a2e1f] rounded-xl p-4 flex flex-col gap-3">
          <p className="text-gray-400 text-xs uppercase tracking-wider">Territory Control</p>
          <p className="text-white text-xl font-bold">
            {territory[0].toFixed(0)}% — {territory[1].toFixed(0)}%
          </p>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div
              className="bg-[#00e676]"
              style={{ width: `${territory[0]}%` }}
            />
            <div
              className="bg-[#ff5252] flex-1"
            />
          </div>
        </div>

      </div>

      {/* Section 2: Player Distance Table */}
      <div className="flex flex-col gap-3">
        <h2 className="text-white font-semibold text-sm tracking-tight">Distance Covered</h2>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-gray-400 text-xs uppercase tracking-wider pb-2 w-8">Team</th>
              <th className="text-left text-gray-400 text-xs uppercase tracking-wider pb-2">Player</th>
              <th className="text-right text-gray-400 text-xs uppercase tracking-wider pb-2">Distance</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((player, i) => (
              <tr
                key={player.id}
                className={[
                  'border-t border-[#1a2e1f]',
                  i % 2 === 0 ? 'bg-[#0d1f12]/40' : '',
                ].join(' ')}
              >
                <td className="py-2.5 pr-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: player.team === 0 ? '#00e676' : '#ff5252' }}
                  />
                </td>
                <td className="py-2.5 text-white font-mono">#{player.id}</td>
                <td className="py-2.5 text-right text-gray-300 font-mono">
                  {(player.metres / 1000).toFixed(2)} km
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}
