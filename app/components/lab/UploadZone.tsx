'use client'

import { useRef, useState, useCallback, DragEvent, ChangeEvent } from 'react'
import { UploadSimple, Warning, CheckCircle } from '@phosphor-icons/react'

interface UploadZoneProps {
  onUploadComplete: (jobId: string) => void
}

type UploadState = 'idle' | 'dragging' | 'uploading' | 'error'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [progress, setProgress] = useState(0)
  const [uploadingFile, setUploadingFile] = useState<{ name: string; size: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setErrorMsg(null)
    setProgress(0)
    setUploadingFile({ name: file.name, size: file.size })
    setState('uploading')

    let jobId: string
    let uploadUrl: string

    // Step 1: Request a presigned upload URL
    try {
      const res = await fetch('/api/jobs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'video/mp4',
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `Upload init failed (${res.status})`)
      }
      const data = await res.json()
      jobId = data.jobId
      uploadUrl = data.uploadUrl
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to initialise upload')
      return
    }

    // Step 2: PUT the file directly to S3 via XHR (for upload progress)
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`S3 upload failed (${xhr.status})`))
        }
      }

      xhr.onerror = () => reject(new Error('Network error during S3 upload'))
      xhr.send(file)
    }).catch((err) => {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Upload to storage failed')
      return Promise.reject(err)
    })

    if (state === 'error') return

    // Step 3: Start the pipeline
    try {
      const startRes = await fetch(`/api/jobs/${jobId}/start`, { method: 'POST' })
      if (!startRes.ok) {
        const data = await startRes.json().catch(() => ({}))
        throw new Error(data.error ?? `Pipeline start failed (${startRes.status})`)
      }
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start analysis pipeline')
      return
    }

    // Step 4: Notify parent and reset
    setState('idle')
    setProgress(0)
    setUploadingFile(null)
    onUploadComplete(jobId)
  }, [onUploadComplete, state])

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (state === 'uploading') return
      setState('idle')
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile, state]
  )

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (state !== 'uploading') setState('dragging')
  }

  const onDragLeave = () => {
    if (state === 'dragging') setState('idle')
  }

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    // Reset input so the same file can be re-selected after an error
    e.target.value = ''
  }

  const retry = () => {
    setErrorMsg(null)
    setUploadingFile(null)
    setState('idle')
    setProgress(0)
  }

  const borderClass =
    state === 'dragging'
      ? 'border-[#00e676] bg-[#00e676]/5'
      : state === 'error'
      ? 'border-red-500/50 bg-[#0d1f12]'
      : 'border-[#1a2e1f] bg-[#0d1f12] hover:border-[#00e676]/40 hover:bg-[#0d1f12]/80'

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed transition-colors duration-200 ${borderClass}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => state === 'idle' && inputRef.current?.click()}
      style={{ cursor: state === 'idle' ? 'pointer' : 'default' }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={onInputChange}
      />

      <div className="flex flex-col items-center justify-center gap-4 p-10 min-h-[200px] text-center">
        {state === 'idle' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#00e676]/10 flex items-center justify-center">
              <UploadSimple size={28} className="text-[#00e676]" weight="bold" />
            </div>
            <div>
              <p className="text-white font-semibold text-base">Drop a match video here</p>
              <p className="text-white/40 text-sm mt-1">or click to browse — MP4, MOV, AVI accepted</p>
            </div>
          </>
        )}

        {state === 'dragging' && (
          <>
            <div className="w-14 h-14 rounded-full bg-[#00e676]/20 flex items-center justify-center">
              <UploadSimple size={28} className="text-[#00e676]" weight="bold" />
            </div>
            <p className="text-[#00e676] font-semibold text-base">Release to upload</p>
          </>
        )}

        {state === 'uploading' && uploadingFile && (
          <div className="w-full max-w-sm flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white font-medium truncate max-w-[220px]">{uploadingFile.name}</span>
              <span className="text-white/40 shrink-0 ml-2">{formatBytes(uploadingFile.size)}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-[#00e676] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[#00e676] text-sm font-medium tabular-nums">{progress}% uploaded</p>
          </div>
        )}

        {state === 'error' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <Warning size={28} className="text-red-400" weight="bold" />
            </div>
            <div>
              <p className="text-red-400 font-semibold text-base">Upload failed</p>
              {errorMsg && <p className="text-white/40 text-sm mt-1">{errorMsg}</p>}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); retry() }}
              className="mt-1 px-4 py-2 rounded-lg bg-[#1a2e1f] text-[#00e676] text-sm font-medium hover:bg-[#00e676]/15 transition-colors"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  )
}
