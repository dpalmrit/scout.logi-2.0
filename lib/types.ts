export interface Job {
  id: string
  userId: string
  filename: string
  videoKey: string
  status: 'queued' | 'processing' | 'done' | 'error' | 'cancelled'
  progress: number
  createdAt: string
  completedAt?: string
  error?: string
  resultsKey?: string
}

export interface ResultsFrame {
  t: number
  players: Array<{
    id: number
    team: 0 | 1
    role: 'player' | 'goalkeeper' | 'referee'
    pitch_x: number | null
    pitch_y: number | null
  }>
  ball: { pitch_x: number; pitch_y: number } | null
}

export interface Results {
  meta: {
    fps: number
    duration: number
    frameCount: number
  }
  frames: ResultsFrame[]
  trajectory: Array<[number, number]>
  stats: {
    possession: [number, number]
    distances: Array<{ id: number; team: 0 | 1; metres: number }>
    territory: [number, number]
  }
}

export interface VizProps {
  results: Results
  frameIdx: number
  onFrameChange: (idx: number) => void
}
