'use client'

import { useEffect, useRef } from 'react'
import type { VizProps } from '@/lib/types'

// Canvas logical size — 10px per metre (105m × 68m pitch)
const CW = 1050
const CH = 680

function drawPitch(ctx: CanvasRenderingContext2D) {
  // Background
  ctx.fillStyle = '#0d1f12'
  ctx.fillRect(0, 0, CW, CH)

  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.lineWidth = 2
  ctx.fillStyle = 'rgba(255,255,255,0.3)'

  // Outer rectangle
  ctx.strokeRect(0, 0, CW, CH)

  // Centre line
  ctx.beginPath()
  ctx.moveTo(525, 0)
  ctx.lineTo(525, CH)
  ctx.stroke()

  // Centre circle
  ctx.beginPath()
  ctx.arc(525, 340, 91.5, 0, Math.PI * 2)
  ctx.stroke()

  // Centre spot
  ctx.beginPath()
  ctx.arc(525, 340, 5, 0, Math.PI * 2)
  ctx.fill()

  // Penalty areas
  // Left: 16.5m deep (165px), 40.5m wide each side from centre (405px total)
  ctx.strokeRect(0, 137.5, 165, 405)
  // Right
  ctx.strokeRect(885, 137.5, 165, 405)

  // Goal areas (6-yard boxes)
  // Left: 5.5m deep (55px), 19.9m wide each side (199px total)
  ctx.strokeRect(0, 240.5, 55, 199)
  // Right
  ctx.strokeRect(995, 240.5, 55, 199)

  // Goals (simplified as small filled rectangles)
  // Left goal at x=0, y=302.5, w=10, h=75
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(0, 302.5, 10, 75)
  ctx.strokeRect(0, 302.5, 10, 75)
  // Right goal at x=1040, y=302.5, w=10, h=75
  ctx.fillRect(1040, 302.5, 10, 75)
  ctx.strokeRect(1040, 302.5, 10, 75)

  // Reset fill for upcoming shapes
  ctx.fillStyle = 'rgba(255,255,255,0.3)'

  // Corner arcs (quarter-circles, radius 10px)
  // Top-left
  ctx.beginPath()
  ctx.arc(0, 0, 10, 0, Math.PI * 0.5)
  ctx.stroke()
  // Top-right
  ctx.beginPath()
  ctx.arc(CW, 0, 10, Math.PI * 0.5, Math.PI)
  ctx.stroke()
  // Bottom-left
  ctx.beginPath()
  ctx.arc(0, CH, 10, Math.PI * 1.5, Math.PI * 2)
  ctx.stroke()
  // Bottom-right
  ctx.beginPath()
  ctx.arc(CW, CH, 10, Math.PI, Math.PI * 1.5)
  ctx.stroke()
}

export default function RadarCanvas({ results, frameIdx, onFrameChange }: VizProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw pitch background
    drawPitch(ctx)

    const frame = results.frames[frameIdx]
    if (!frame) return

    // Draw players
    for (const player of frame.players) {
      const cx = player.pitch_x * 10
      const cy = player.pitch_y * 10

      let color: string
      let alpha: number
      let radius: number

      if (player.role === 'referee') {
        color = '#ffeb3b'
        alpha = 1
        radius = 6
      } else if (player.team === 0) {
        color = '#00e676'
        alpha = player.role === 'goalkeeper' ? 0.9 : 0.7
        radius = 8
      } else {
        color = '#ff5252'
        alpha = player.role === 'goalkeeper' ? 0.9 : 0.7
        radius = 8
      }

      // Filled dot
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(cx, cy, radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1

      // Player ID label
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 10px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(player.id), cx, cy)
    }

    // Draw ball
    if (frame.ball) {
      const bx = frame.ball.pitch_x * 10
      const by = frame.ball.pitch_y * 10

      // White filled circle
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(bx, by, 6, 0, Math.PI * 2)
      ctx.fill()

      // Gray border
      ctx.strokeStyle = 'rgba(150,150,150,0.8)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(bx, by, 8, 0, Math.PI * 2)
      ctx.stroke()
    }
  }, [frameIdx, results])

  return (
    <canvas
      ref={canvasRef}
      width={CW}
      height={CH}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    />
  )
}
