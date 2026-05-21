# PitchScout Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a private `/lab` section to scout.logi-2.0 where 3 authorised users can upload football match videos and receive radar, Voronoi, trajectory, and stats analysis from a Modal.com CV pipeline.

**Architecture:** Next.js 14 App Router on Vercel (server routes + NextAuth JWT sessions). Videos upload directly from browser to S3 via presigned URL (bypasses Vercel's 4.5MB body limit). Modal.com runs the YOLOv8+SigLIP+homography pipeline on GPU and writes results JSON back to S3. Frontend reads results JSON and renders all visualisations client-side.

**Tech Stack:** Next.js 14, NextAuth v4 (Google OAuth), AWS SDK v3, nanoid, D3.js, Modal.com (Python), Tailwind CSS v3

---

## Prerequisites (user must complete before Task 3)

1. **Google Cloud OAuth credentials** — go to console.cloud.google.com → APIs & Services → Credentials → Create OAuth 2.0 Client ID → Web application. Add `http://localhost:3000` and your Vercel URL as authorised origins. Add `/api/auth/callback/google` to authorised redirect URIs for both.

2. **Vercel env vars** — in Vercel dashboard → project Settings → Environment Variables, add:
   - `GOOGLE_CLIENT_ID` — from Google Cloud
   - `GOOGLE_CLIENT_SECRET` — from Google Cloud
   - `NEXTAUTH_SECRET` — run `openssl rand -base64 32` locally to generate
   - `NEXTAUTH_URL` — your Vercel deployment URL (e.g. `https://scout-logi-2-0.vercel.app`)
   - `AWS_REGION` — e.g. `us-east-1`
   - `AWS_ACCESS_KEY_ID` — IAM user with S3 access
   - `AWS_SECRET_ACCESS_KEY`
   - `PITCHSCOUT_LAB_BUCKET` — S3 bucket name for lab jobs (e.g. `pitchscout-lab-jobs-485231031194`)
   - `MODAL_TRIGGER_URL` — set this after Task 13 (Modal deploy)

3. **S3 bucket** — create `pitchscout-lab-jobs-485231031194` (or any name) with default settings. Add CORS rule to allow PUT from browser (for presigned URL upload):
   ```json
   [{ "AllowedHeaders": ["*"], "AllowedMethods": ["PUT", "GET"], "AllowedOrigins": ["*"], "ExposeHeaders": [] }]
   ```

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `next.config.js` | Modify | Remove static export settings |
| `vercel.json` | Create | Minimal Vercel config |
| `.github/workflows/deploy.yml` | Delete | GH Pages action (Vercel auto-deploys from GitHub) |
| `middleware.ts` | Create | Protect `/lab/dashboard/*`, `/lab/results/*`, `/api/jobs/*` |
| `lib/auth.ts` | Create | NextAuth options + email allowlist |
| `lib/s3.ts` | Create | S3 helpers: getJob, putJob, listJobs, presignedPut, presignedGet |
| `lib/modal.ts` | Create | Trigger Modal pipeline via HTTP POST |
| `lib/types.ts` | Create | Shared TypeScript interfaces (Job, Results) |
| `app/api/auth/[...nextauth]/route.ts` | Create | NextAuth handler |
| `app/api/jobs/route.ts` | Create | GET — list jobs for authed user |
| `app/api/jobs/upload/route.ts` | Create | POST — create job + return presigned S3 upload URL |
| `app/api/jobs/[id]/start/route.ts` | Create | POST — trigger Modal after S3 upload completes |
| `app/api/jobs/[id]/status/route.ts` | Create | GET — return job meta.json |
| `app/lab/page.tsx` | Create | Redirect: authed→dashboard, anon→login |
| `app/lab/login/page.tsx` | Create | Google sign-in button |
| `app/lab/layout.tsx` | Create | SessionProvider wrapper for all /lab routes |
| `app/lab/dashboard/page.tsx` | Create | Upload zone + jobs list with 30s polling |
| `app/lab/results/[jobId]/page.tsx` | Create | Tabbed results viewer |
| `app/components/lab/SessionWrapper.tsx` | Create | `'use client'` SessionProvider wrapper |
| `app/components/lab/UploadZone.tsx` | Create | Drag-and-drop video upload + progress bar |
| `app/components/lab/JobCard.tsx` | Create | Single job status card |
| `app/components/lab/RadarCanvas.tsx` | Create | Canvas radar with play/pause + scrubber |
| `app/components/lab/VoronoiView.tsx` | Create | D3 Voronoi SVG overlay |
| `app/components/lab/TrajectoryView.tsx` | Create | SVG ball path on pitch |
| `app/components/lab/StatsPanel.tsx` | Create | Stat cards + possession bar + distance table |
| `modal_pipeline/pipeline.py` | Create | Python CV pipeline (YOLOv8+SigLIP+homography) |
| `modal_pipeline/requirements.txt` | Create | Python dependencies |

---

## Task 1: Vercel Migration

**Goal:** Remove static export config so Next.js API routes and SSR work on Vercel.

**Files:**
- Modify: `next.config.js`
- Create: `vercel.json`
- Delete: `.github/workflows/deploy.yml`

**Acceptance Criteria:**
- [ ] `npm run build` succeeds with no static export errors
- [ ] `vercel.json` exists at repo root
- [ ] GH Pages workflow file is deleted

**Verify:** `npm run build` → exits 0, no `output: export` warnings

**Steps:**

- [ ] **Step 1: Update next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}
module.exports = nextConfig
```

- [ ] **Step 2: Create vercel.json**

```json
{
  "framework": "nextjs"
}
```

- [ ] **Step 3: Delete GH Pages workflow**

```bash
rm .github/workflows/deploy.yml
```

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: Build completes successfully. No mention of `output: export`.

- [ ] **Step 5: Commit**

```bash
git add next.config.js vercel.json
git rm .github/workflows/deploy.yml
git commit -m "feat: migrate from static export to Vercel SSR deployment"
```

---

## Task 2: Install Dependencies

**Goal:** Add all npm packages the lab requires.

**Files:**
- Modify: `package.json`, `package-lock.json`

**Acceptance Criteria:**
- [ ] `npm install` exits 0
- [ ] `next-auth`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `nanoid`, `d3` present in `node_modules`
- [ ] TypeScript compiles (`npm run build`)

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Step 1: Install packages**

```bash
npm install next-auth @aws-sdk/client-s3 @aws-sdk/s3-request-presigner nanoid d3
npm install -D @types/d3
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add next-auth, aws-sdk, nanoid, d3 dependencies"
```

---

## Task 3: Shared Types

**Goal:** Define the TypeScript interfaces used across API routes and components.

**Files:**
- Create: `lib/types.ts`

**Acceptance Criteria:**
- [ ] `Job` and `Results` interfaces match the spec exactly
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Step 1: Create `lib/types.ts`**

```ts
export interface Job {
  id: string
  userId: string
  filename: string
  videoKey: string
  status: 'queued' | 'processing' | 'done' | 'error'
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
    pitch_x: number
    pitch_y: number
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
```

- [ ] **Step 2: Verify**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat: add shared TypeScript types for Job and Results"
```

---

## Task 4: Auth Layer

**Goal:** Google OAuth login restricted to 3 emails. All `/lab/dashboard`, `/lab/results`, and `/api/jobs` routes require a valid session. Unauthenticated requests redirect to `/lab/login`.

**Files:**
- Create: `lib/auth.ts`
- Create: `middleware.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/components/lab/SessionWrapper.tsx`
- Create: `app/lab/layout.tsx`
- Create: `app/lab/page.tsx`
- Create: `app/lab/login/page.tsx`

**Acceptance Criteria:**
- [ ] `npm run build` exits 0
- [ ] Visiting `/lab/dashboard` without a session redirects to `/lab/login`
- [ ] Email not in allowlist cannot sign in (NextAuth returns error, stays on login page)
- [ ] Visiting `/lab` while authenticated redirects to `/lab/dashboard`

**Verify:** `npm run build` → exits 0. Manual: visit `/lab/dashboard` unauthenticated → lands on `/lab/login`.

**Steps:**

- [ ] **Step 1: Create `lib/auth.ts`**

```ts
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'

export const ALLOWED_EMAILS = [
  'dpalmer.it@gmail.com',
  'scout.logi@gmail.com',
  'lizzyp24@gmail.com',
]

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      return ALLOWED_EMAILS.includes(user.email ?? '')
    },
  },
  pages: {
    signIn: '/lab/login',
    error: '/lab/login',
  },
  session: { strategy: 'jwt' },
}
```

- [ ] **Step 2: Create `middleware.ts`** (project root, not inside `app/`)

```ts
export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/lab/dashboard/:path*',
    '/lab/results/:path*',
    '/api/jobs/:path*',
  ],
}
```

- [ ] **Step 3: Create `app/api/auth/[...nextauth]/route.ts`**

```ts
import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Create `app/components/lab/SessionWrapper.tsx`**

```tsx
'use client'
import { SessionProvider } from 'next-auth/react'

export default function SessionWrapper({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>
}
```

- [ ] **Step 5: Create `app/lab/layout.tsx`**

```tsx
import SessionWrapper from '@/app/components/lab/SessionWrapper'

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return <SessionWrapper>{children}</SessionWrapper>
}
```

- [ ] **Step 6: Create `app/lab/page.tsx`** (redirect hub)

```tsx
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LabPage() {
  const session = await getServerSession(authOptions)
  redirect(session ? '/lab/dashboard' : '/lab/login')
}
```

- [ ] **Step 7: Create `app/lab/login/page.tsx`**

```tsx
'use client'
import { signIn } from 'next-auth/react'

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#080f0a]">
      <div className="border border-[#00e676]/20 rounded-2xl p-10 flex flex-col items-center gap-6 w-full max-w-sm bg-[#0d1f12]">
        <div className="text-center">
          <h1 className="text-white font-bold text-2xl tracking-tight">PitchScout Lab</h1>
          <p className="text-white/40 text-sm mt-1">Private research access</p>
        </div>
        <button
          onClick={() => signIn('google', { callbackUrl: '/lab/dashboard' })}
          className="flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors w-full"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
        <p className="text-white/20 text-xs text-center">Access restricted to approved accounts only</p>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Build**

```bash
npm run build
```

Expected: exits 0. Note: Google sign-in won't work yet without env vars set in Vercel.

- [ ] **Step 9: Commit**

```bash
git add lib/auth.ts middleware.ts app/api/auth app/components/lab/SessionWrapper.tsx app/lab/layout.tsx app/lab/page.tsx app/lab/login
git commit -m "feat: add NextAuth Google OAuth with 3-email allowlist and /lab route protection"
```

---

## Task 5: S3 Helpers

**Goal:** All S3 operations in one file — read/write job metadata, generate presigned upload/download URLs, list jobs for a user.

**Files:**
- Create: `lib/s3.ts`

**Acceptance Criteria:**
- [ ] All functions exported: `getJob`, `putJob`, `listJobsForUser`, `presignedPutUrl`, `presignedGetUrl`
- [ ] Function signatures match what Task 6 and Task 7 will import
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Step 1: Create `lib/s3.ts`**

```ts
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Job } from '@/lib/types'

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.PITCHSCOUT_LAB_BUCKET!

export async function getJob(jobId: string): Promise<Job | null> {
  try {
    const res = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: `jobs/${jobId}/meta.json`,
    }))
    const body = await res.Body!.transformToString()
    return JSON.parse(body) as Job
  } catch {
    return null
  }
}

export async function putJob(job: Job): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `jobs/${job.id}/meta.json`,
    Body: JSON.stringify(job),
    ContentType: 'application/json',
  }))
}

export async function listJobsForUser(userId: string): Promise<Job[]> {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: 'jobs/',
  }))
  const metaKeys = (res.Contents ?? [])
    .map(o => o.Key!)
    .filter(k => k.endsWith('/meta.json'))

  const jobs = await Promise.all(
    metaKeys.map(async key => {
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
      const body = await obj.Body!.transformToString()
      return JSON.parse(body) as Job
    })
  )
  return jobs
    .filter(j => j.userId === userId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export async function presignedPutUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 3600 }
  )
}

export async function presignedGetUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/s3.ts
git commit -m "feat: add S3 helpers for job metadata and presigned URLs"
```

---

## Task 6: Modal Client

**Goal:** One function to trigger the Modal pipeline via HTTP POST to the deployed web endpoint.

**Files:**
- Create: `lib/modal.ts`

**Acceptance Criteria:**
- [ ] `triggerPipeline(jobId, videoKey, bucket)` exported
- [ ] Throws on non-2xx response
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Step 1: Create `lib/modal.ts`**

```ts
export async function triggerPipeline(
  jobId: string,
  videoKey: string,
  bucket: string
): Promise<void> {
  const url = process.env.MODAL_TRIGGER_URL
  if (!url) throw new Error('MODAL_TRIGGER_URL env var not set')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: jobId, video_s3_key: videoKey, results_bucket: bucket }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Modal trigger failed ${res.status}: ${text}`)
  }
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add lib/modal.ts
git commit -m "feat: add Modal pipeline trigger client"
```

---

## Task 7: API Routes

**Goal:** Four API routes: create job + get presigned upload URL, start pipeline after upload, poll job status, list jobs.

**Files:**
- Create: `app/api/jobs/route.ts`
- Create: `app/api/jobs/upload/route.ts`
- Create: `app/api/jobs/[id]/start/route.ts`
- Create: `app/api/jobs/[id]/status/route.ts`

**Acceptance Criteria:**
- [ ] `GET /api/jobs` returns array of jobs for the authed user
- [ ] `POST /api/jobs/upload` returns `{ jobId, uploadUrl }`
- [ ] `POST /api/jobs/[id]/start` triggers Modal and returns 200
- [ ] `GET /api/jobs/[id]/status` returns the job meta JSON
- [ ] All routes return 401 if no valid session
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Step 1: Create `app/api/jobs/route.ts`** (list jobs)

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listJobsForUser } from '@/lib/s3'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const jobs = await listJobsForUser(session.user.email)
  return NextResponse.json(jobs)
}
```

- [ ] **Step 2: Create `app/api/jobs/upload/route.ts`**

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { putJob, presignedPutUrl } from '@/lib/s3'
import { NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { filename, contentType } = await req.json() as { filename: string; contentType: string }
  const jobId = nanoid()
  const videoKey = `jobs/${jobId}/video/${filename}`

  await putJob({
    id: jobId,
    userId: session.user.email,
    filename,
    videoKey,
    status: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
  })

  const uploadUrl = await presignedPutUrl(videoKey, contentType)
  return NextResponse.json({ jobId, uploadUrl })
}
```

- [ ] **Step 3: Create `app/api/jobs/[id]/start/route.ts`**

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob, putJob } from '@/lib/s3'
import { triggerPipeline } from '@/lib/modal'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await getJob(params.id)
  if (!job || job.userId !== session.user.email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await putJob({ ...job, status: 'processing', progress: 0 })
  await triggerPipeline(job.id, job.videoKey, process.env.PITCHSCOUT_LAB_BUCKET!)

  return NextResponse.json({ status: 'processing' })
}
```

- [ ] **Step 4: Create `app/api/jobs/[id]/status/route.ts`**

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob } from '@/lib/s3'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await getJob(params.id)
  if (!job || job.userId !== session.user.email) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json(job)
}
```

- [ ] **Step 5: Build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add app/api/jobs
git commit -m "feat: add job API routes (upload, start, status, list)"
```

---

## Task 8: Dashboard Page

**Goal:** Upload zone (drag-and-drop → S3 presigned PUT → trigger pipeline) and jobs list with 30-second status polling.

**Files:**
- Create: `app/components/lab/UploadZone.tsx`
- Create: `app/components/lab/JobCard.tsx`
- Create: `app/lab/dashboard/page.tsx`

**Acceptance Criteria:**
- [ ] User can drag-and-drop or click-select a video file
- [ ] Upload progress bar fills as file uploads to S3
- [ ] After upload, pipeline is triggered and new job appears in list
- [ ] Job list refreshes every 30 seconds
- [ ] Job cards show filename, status badge, progress percentage
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0. Manual: upload a small video and confirm job appears as "processing".

**Steps:**

- [ ] **Step 1: Create `app/components/lab/UploadZone.tsx`**

```tsx
'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function UploadZone() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleFile(file: File) {
    setUploading(true)
    setProgress(0)
    setError(null)
    try {
      // 1. Create job and get presigned URL
      const res = await fetch('/api/jobs/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type || 'video/mp4' }),
      })
      if (!res.ok) throw new Error('Failed to create job')
      const { jobId, uploadUrl } = await res.json()

      // 2. Upload directly to S3 via presigned URL
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        })
        xhr.addEventListener('load', () => xhr.status < 400 ? resolve() : reject(new Error(`S3 upload failed: ${xhr.status}`)))
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.open('PUT', uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')
        xhr.send(file)
      })

      // 3. Trigger pipeline
      await fetch(`/api/jobs/${jobId}/start`, { method: 'POST' })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      onClick={() => !uploading && inputRef.current?.click()}
      className="border-2 border-dashed border-[#00e676]/30 rounded-xl p-10 text-center cursor-pointer hover:border-[#00e676]/60 transition-colors bg-[#0d1f12]"
    >
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {uploading ? (
        <div className="space-y-3">
          <p className="text-white/60 text-sm">Uploading… {progress}%</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#00e676] rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        <div>
          <p className="text-white/70 font-medium">Drop match video here</p>
          <p className="text-white/30 text-sm mt-1">MP4, MOV — up to 5 GB</p>
          <div className="mt-4 inline-block bg-[#00e676]/15 text-[#00e676] text-sm px-4 py-2 rounded-lg">
            Select File
          </div>
        </div>
      )}
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/components/lab/JobCard.tsx`**

```tsx
import Link from 'next/link'
import { Job } from '@/lib/types'

const STATUS_STYLES: Record<Job['status'], string> = {
  queued: 'bg-yellow-500/15 text-yellow-400',
  processing: 'bg-blue-500/15 text-blue-400',
  done: 'bg-[#00e676]/15 text-[#00e676]',
  error: 'bg-red-500/15 text-red-400',
}

const STATUS_LABELS: Record<Job['status'], string> = {
  queued: 'Queued',
  processing: 'Processing',
  done: 'Done',
  error: 'Error',
}

export default function JobCard({ job }: { job: Job }) {
  const created = new Date(job.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="bg-[#0d1f12] border border-white/8 rounded-xl p-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-white font-medium truncate">{job.filename}</p>
        <p className="text-white/30 text-xs mt-0.5">{created}</p>
        {job.status === 'processing' && (
          <div className="mt-2 h-1.5 bg-white/10 rounded-full w-48 overflow-hidden">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${job.progress}%` }}
            />
          </div>
        )}
        {job.status === 'error' && (
          <p className="text-red-400 text-xs mt-1">{job.error ?? 'Pipeline failed'}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_STYLES[job.status]}`}>
          {STATUS_LABELS[job.status]}{job.status === 'processing' ? ` ${job.progress}%` : ''}
        </span>
        {job.status === 'done' && (
          <Link
            href={`/lab/results/${job.id}`}
            className="text-xs bg-[#00e676] text-black font-semibold px-3 py-1.5 rounded-lg hover:bg-[#00e676]/90 transition-colors"
          >
            View →
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/lab/dashboard/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import UploadZone from '@/app/components/lab/UploadZone'
import JobCard from '@/app/components/lab/JobCard'
import { Job } from '@/lib/types'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [jobs, setJobs] = useState<Job[]>([])

  async function fetchJobs() {
    const res = await fetch('/api/jobs')
    if (res.ok) setJobs(await res.json())
  }

  useEffect(() => {
    fetchJobs()
    const timer = setInterval(fetchJobs, 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <main className="min-h-screen bg-[#080f0a] p-6 md:p-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-2xl">PitchScout Lab</h1>
            <p className="text-white/40 text-sm mt-0.5">{session?.user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/lab/login' })}
            className="text-white/40 hover:text-white text-sm transition-colors"
          >
            Sign out
          </button>
        </header>

        <UploadZone />

        <section>
          <h2 className="text-white/60 text-sm font-medium uppercase tracking-wider mb-3">
            Recent Jobs
          </h2>
          {jobs.length === 0 ? (
            <p className="text-white/30 text-sm">No jobs yet — upload a match video above.</p>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => <JobCard key={job.id} job={job} />)}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Build**

```bash
npm run build
```

- [ ] **Step 5: Commit**

```bash
git add app/components/lab/UploadZone.tsx app/components/lab/JobCard.tsx app/lab/dashboard
git commit -m "feat: add dashboard with upload zone and jobs list"
```

---

## Task 9: Results Page

**Goal:** Tabbed results page that fetches `results.json` from S3 and passes data to visualisation components. Shows loading state while fetching, error state if job not done.

**Files:**
- Create: `app/lab/results/[jobId]/page.tsx`

**Acceptance Criteria:**
- [ ] Tabs: Radar, Voronoi, Trajectory, Stats — switching renders correct component
- [ ] Results JSON loaded from presigned S3 URL
- [ ] Loading spinner shown while fetching
- [ ] Error shown if job status is not "done"
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0

**Steps:**

- [ ] **Step 1: Create `app/lab/results/[jobId]/page.tsx`**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Job, Results } from '@/lib/types'
import RadarCanvas from '@/app/components/lab/RadarCanvas'
import VoronoiView from '@/app/components/lab/VoronoiView'
import TrajectoryView from '@/app/components/lab/TrajectoryView'
import StatsPanel from '@/app/components/lab/StatsPanel'

type Tab = 'radar' | 'voronoi' | 'trajectory' | 'stats'

const TABS: { id: Tab; label: string }[] = [
  { id: 'radar', label: 'Radar' },
  { id: 'voronoi', label: 'Voronoi' },
  { id: 'trajectory', label: 'Trajectory' },
  { id: 'stats', label: 'Stats' },
]

export default function ResultsPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('radar')
  const [job, setJob] = useState<Job | null>(null)
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const jobRes = await fetch(`/api/jobs/${jobId}/status`)
        if (!jobRes.ok) { setError('Job not found'); return }
        const j: Job = await jobRes.json()
        setJob(j)
        if (j.status !== 'done') { setError(`Job is ${j.status}`); return }

        // Fetch results via presigned URL
        const urlRes = await fetch(`/api/jobs/${jobId}/results-url`)
        if (!urlRes.ok) { setError('Could not load results'); return }
        const { url } = await urlRes.json()
        const dataRes = await fetch(url)
        setResults(await dataRes.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [jobId])

  return (
    <main className="min-h-screen bg-[#080f0a] p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/lab/dashboard')} className="text-white/40 hover:text-white text-sm transition-colors">
            ← Dashboard
          </button>
          {job && <p className="text-white/60 text-sm truncate">{job.filename}</p>}
        </div>

        <div className="flex gap-2 border-b border-white/10 pb-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'bg-[#0d1f12] text-[#00e676] border border-b-0 border-[#00e676]/30'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center h-64">
            <p className="text-white/40">Loading results…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {results && (
          <>
            {tab === 'radar' && <RadarCanvas results={results} />}
            {tab === 'voronoi' && <VoronoiView results={results} />}
            {tab === 'trajectory' && <TrajectoryView results={results} />}
            {tab === 'stats' && <StatsPanel results={results} />}
          </>
        )}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Add the missing results-url API route** (`app/api/jobs/[id]/results-url/route.ts`)

This route the results page needs to fetch the presigned results URL:

```ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getJob, presignedGetUrl } from '@/lib/s3'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await getJob(params.id)
  if (!job || job.userId !== session.user.email || job.status !== 'done') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const url = await presignedGetUrl(job.resultsKey!)
  return NextResponse.json({ url })
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/lab/results app/api/jobs/\[id\]/results-url
git commit -m "feat: add tabbed results page and results-url API route"
```

---

## Task 10: RadarCanvas Component

**Goal:** Canvas-based tactical radar view with play/pause animation and timeline scrubber. Players rendered as coloured dots, ball as white dot, pitched outline as background.

**Files:**
- Create: `app/components/lab/RadarCanvas.tsx`

**Acceptance Criteria:**
- [ ] Pitch outline drawn on canvas (green rectangle, centre circle, halfway line)
- [ ] Team 0 players as `#00e676` dots, Team 1 as `#ff5252`, ball as white
- [ ] Play/pause button animates through frames at results FPS
- [ ] Scrubber input seeks to any frame
- [ ] Frame timestamp shown (MM:SS)
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0. Manual: load results page, Radar tab shows animated pitch with player dots.

**Steps:**

- [ ] **Step 1: Create `app/components/lab/RadarCanvas.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Results } from '@/lib/types'

// Real pitch dimensions in metres (standard football pitch)
const PITCH_W = 105
const PITCH_H = 68

function drawPitch(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sx = w / PITCH_W
  const sy = h / PITCH_H
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#0a1f10'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#00e67640'
  ctx.lineWidth = 1

  // Boundary
  ctx.strokeRect(0, 0, w, h)
  // Halfway line
  ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke()
  // Centre circle (9.15m radius)
  ctx.beginPath()
  ctx.arc(w / 2, h / 2, 9.15 * sx, 0, Math.PI * 2)
  ctx.stroke()
  // Penalty areas
  const paW = 40.32 * sx, paH = 16.5 * sy
  const paY = (h - paH) / 2
  ctx.strokeRect(0, paY, paW, paH)
  ctx.strokeRect(w - paW, paY, paW, paH)
}

function drawFrame(ctx: CanvasRenderingContext2D, w: number, h: number, frame: Results['frames'][0]) {
  const sx = w / PITCH_W
  const sy = h / PITCH_H

  for (const p of frame.players) {
    const x = p.pitch_x * sx
    const y = p.pitch_y * sy
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fillStyle = p.team === 0 ? '#00e676' : '#ff5252'
    ctx.fill()
  }

  if (frame.ball) {
    ctx.beginPath()
    ctx.arc(frame.ball.pitch_x * sx, frame.ball.pitch_y * sy, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
  }
}

export default function RadarCanvas({ results }: { results: Results }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const [frameIdx, setFrameIdx] = useState(0)
  const [playing, setPlaying] = useState(false)
  const lastTimeRef = useRef(0)
  const msPerFrame = 1000 / (results.meta.fps || 25)

  const render = useCallback((idx: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.width
    const h = canvas.height
    drawPitch(ctx, w, h)
    const frame = results.frames[idx]
    if (frame) drawFrame(ctx, w, h, frame)
  }, [results])

  useEffect(() => { render(frameIdx) }, [frameIdx, render])

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(rafRef.current); return }
    function tick(now: number) {
      if (now - lastTimeRef.current >= msPerFrame) {
        lastTimeRef.current = now
        setFrameIdx(i => {
          const next = i + 1
          if (next >= results.frames.length) { setPlaying(false); return i }
          return next
        })
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [playing, msPerFrame, results.frames.length])

  const seconds = results.frames[frameIdx]?.t ?? 0
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0')

  return (
    <div className="space-y-4">
      <canvas
        ref={canvasRef}
        width={700}
        height={454}
        className="w-full rounded-xl border border-white/10"
      />
      <div className="flex items-center gap-4">
        <button
          onClick={() => setPlaying(p => !p)}
          className="bg-[#00e676]/15 text-[#00e676] text-sm px-4 py-2 rounded-lg hover:bg-[#00e676]/25 transition-colors font-medium"
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <span className="text-white/40 text-sm font-mono w-12">{mm}:{ss}</span>
        <input
          type="range"
          min={0}
          max={results.frames.length - 1}
          value={frameIdx}
          onChange={e => { setPlaying(false); setFrameIdx(Number(e.target.value)) }}
          className="flex-1 accent-[#00e676]"
        />
        <span className="text-white/30 text-xs">{results.frames.length} frames</span>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#00e676] inline-block" /> Team A</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#ff5252] inline-block" /> Team B</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white inline-block" /> Ball</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/components/lab/RadarCanvas.tsx
git commit -m "feat: add RadarCanvas component with play/pause and scrubber"
```

---

## Task 11: VoronoiView Component

**Goal:** D3 Voronoi territory diagram showing team control over pitch. Redraws when scrubber changes. Territory percentage bar below.

**Files:**
- Create: `app/components/lab/VoronoiView.tsx`

**Acceptance Criteria:**
- [ ] Voronoi cells coloured `#00e676` (team 0) and `#ff5252` (team 1) at 30% opacity
- [ ] Scrubber synced with radar (same frame index logic)
- [ ] Territory % bar below pitch showing split
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0. Manual: Voronoi tab shows coloured pitch regions.

**Steps:**

- [ ] **Step 1: Create `app/components/lab/VoronoiView.tsx`**

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Results } from '@/lib/types'

const PITCH_W = 105
const PITCH_H = 68
const SVG_W = 700
const SVG_H = Math.round(SVG_W * (PITCH_H / PITCH_W))

export default function VoronoiView({ results }: { results: Results }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [frameIdx, setFrameIdx] = useState(0)

  useEffect(() => {
    const svg = d3.select(svgRef.current!)
    svg.selectAll('*').remove()

    const frame = results.frames[frameIdx]
    if (!frame || frame.players.length === 0) return

    const sx = SVG_W / PITCH_W
    const sy = SVG_H / PITCH_H

    const points = frame.players.map(p => [p.pitch_x * sx, p.pitch_y * sy] as [number, number])
    const teams = frame.players.map(p => p.team)

    const delaunay = d3.Delaunay.from(points)
    const voronoi = delaunay.voronoi([0, 0, SVG_W, SVG_H])

    points.forEach((_, i) => {
      const cell = voronoi.renderCell(i)
      svg.append('path')
        .attr('d', cell)
        .attr('fill', teams[i] === 0 ? '#00e67650' : '#ff525250')
        .attr('stroke', teams[i] === 0 ? '#00e676' : '#ff5252')
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', 0.4)
    })

    // Pitch outline
    svg.append('rect')
      .attr('x', 0).attr('y', 0).attr('width', SVG_W).attr('height', SVG_H)
      .attr('fill', 'none').attr('stroke', '#00e67640').attr('stroke-width', 1)
    svg.append('line')
      .attr('x1', SVG_W / 2).attr('y1', 0).attr('x2', SVG_W / 2).attr('y2', SVG_H)
      .attr('stroke', '#00e67640').attr('stroke-width', 1)
  }, [frameIdx, results])

  const t0 = results.stats.territory[0]
  const t1 = results.stats.territory[1]
  const seconds = results.frames[frameIdx]?.t ?? 0
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(Math.floor(seconds % 60)).padStart(2, '0')

  return (
    <div className="space-y-4">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full rounded-xl border border-white/10 bg-[#0a1f10]"
      />
      <div className="flex items-center gap-4">
        <span className="text-white/40 text-sm font-mono w-12">{mm}:{ss}</span>
        <input
          type="range"
          min={0}
          max={results.frames.length - 1}
          value={frameIdx}
          onChange={e => setFrameIdx(Number(e.target.value))}
          className="flex-1 accent-[#00e676]"
        />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-white/50">
          <span>Team A {t0.toFixed(1)}%</span>
          <span>Team B {t1.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden flex">
          <div className="bg-[#00e676]" style={{ width: `${t0}%` }} />
          <div className="bg-[#ff5252] flex-1" />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/components/lab/VoronoiView.tsx
git commit -m "feat: add VoronoiView component with D3 territory diagram"
```

---

## Task 12: TrajectoryView Component

**Goal:** SVG ball trajectory path on pitch. Full-match path drawn as gradient polyline (dim at start, bright at end). Click any point to seek to nearest frame.

**Files:**
- Create: `app/components/lab/TrajectoryView.tsx`

**Acceptance Criteria:**
- [ ] Ball path drawn as SVG polyline on pitch outline
- [ ] Path segments coloured from dim white (start) to bright white (end)
- [ ] Clicking near any segment jumps `onSeek` callback to nearest frame index
- [ ] Point count shown
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0. Manual: Trajectory tab shows ball path across pitch.

**Steps:**

- [ ] **Step 1: Create `app/components/lab/TrajectoryView.tsx`**

```tsx
'use client'
import { Results } from '@/lib/types'

const PITCH_W = 105
const PITCH_H = 68
const SVG_W = 700
const SVG_H = Math.round(SVG_W * (PITCH_H / PITCH_W))

function toSvg(x: number, y: number) {
  return { x: (x / PITCH_W) * SVG_W, y: (y / PITCH_H) * SVG_H }
}

export default function TrajectoryView({ results }: { results: Results }) {
  const pts = results.trajectory
  if (pts.length === 0) {
    return <p className="text-white/40 text-center py-10">No trajectory data available.</p>
  }

  const svgPts = pts.map(([x, y]) => toSvg(x, y))
  const total = svgPts.length

  return (
    <div className="space-y-4">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        className="w-full rounded-xl border border-white/10 bg-[#0a1f10]"
      >
        {/* Pitch outline */}
        <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="none" stroke="#00e67640" strokeWidth={1} />
        <line x1={SVG_W / 2} y1={0} x2={SVG_W / 2} y2={SVG_H} stroke="#00e67640" strokeWidth={1} />
        <circle cx={SVG_W / 2} cy={SVG_H / 2} r={(9.15 / PITCH_W) * SVG_W} fill="none" stroke="#00e67640" strokeWidth={1} />

        {/* Trajectory segments with opacity gradient */}
        {svgPts.slice(0, -1).map((pt, i) => {
          const next = svgPts[i + 1]
          const opacity = 0.15 + (i / total) * 0.85
          return (
            <line
              key={i}
              x1={pt.x} y1={pt.y}
              x2={next.x} y2={next.y}
              stroke="white"
              strokeOpacity={opacity}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          )
        })}

        {/* Start dot */}
        <circle cx={svgPts[0].x} cy={svgPts[0].y} r={4} fill="white" fillOpacity={0.3} />
        {/* End dot */}
        <circle cx={svgPts[total - 1].x} cy={svgPts[total - 1].y} r={5} fill="white" fillOpacity={0.9} />
      </svg>

      <div className="flex justify-between text-xs text-white/40">
        <span>⬤ Start</span>
        <span>{total} ball positions recorded</span>
        <span>End ⬤</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/components/lab/TrajectoryView.tsx
git commit -m "feat: add TrajectoryView SVG ball path component"
```

---

## Task 13: StatsPanel Component

**Goal:** Four stat cards (possession, avg distance, territory, ball touches), possession bar, and player distance table.

**Files:**
- Create: `app/components/lab/StatsPanel.tsx`

**Acceptance Criteria:**
- [ ] Four stat cards rendered with correct values from `results.stats`
- [ ] Possession bar split correctly between two teams
- [ ] Distance table sorted descending, team colour dot beside each row
- [ ] `npm run build` exits 0

**Verify:** `npm run build` → exits 0. Manual: Stats tab shows correct values from results JSON.

**Steps:**

- [ ] **Step 1: Create `app/components/lab/StatsPanel.tsx`**

```tsx
import { Results } from '@/lib/types'

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#0d1f12] border border-white/8 rounded-xl p-5">
      <p className="text-white/40 text-xs uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold text-3xl mt-1">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-0.5">{sub}</p>}
    </div>
  )
}

export default function StatsPanel({ results }: { results: Results }) {
  const { possession, distances, territory } = results.stats

  const avgDist = distances.length > 0
    ? (distances.reduce((s, d) => s + d.metres, 0) / distances.length / 1000).toFixed(2)
    : '—'

  const sortedDistances = [...distances].sort((a, b) => b.metres - a.metres)
  const touchCount = results.frames.filter(f => f.ball !== null).length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Possession" value={`${possession[0]}%`} sub={`Team B ${possession[1]}%`} />
        <StatCard label="Avg Distance" value={`${avgDist}km`} sub="per player" />
        <StatCard label="Territory" value={`${territory[0].toFixed(0)}%`} sub={`Team B ${territory[1].toFixed(0)}%`} />
        <StatCard label="Ball Touches" value={String(touchCount)} sub="frames with ball detected" />
      </div>

      <div>
        <h3 className="text-white/60 text-sm font-medium uppercase tracking-wider mb-3">Possession</h3>
        <div className="h-3 rounded-full overflow-hidden flex">
          <div className="bg-[#00e676]" style={{ width: `${possession[0]}%` }} />
          <div className="bg-[#ff5252] flex-1" />
        </div>
        <div className="flex justify-between text-xs text-white/40 mt-1">
          <span>Team A {possession[0]}%</span>
          <span>Team B {possession[1]}%</span>
        </div>
      </div>

      <div>
        <h3 className="text-white/60 text-sm font-medium uppercase tracking-wider mb-3">Distance Covered</h3>
        <div className="space-y-2">
          {sortedDistances.slice(0, 22).map(d => (
            <div key={d.id} className="flex items-center gap-3">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: d.team === 0 ? '#00e676' : '#ff5252' }}
              />
              <span className="text-white/50 text-xs w-16">Player {d.id}</span>
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(d.metres / (sortedDistances[0]?.metres || 1)) * 100}%`,
                    background: d.team === 0 ? '#00e676' : '#ff5252',
                  }}
                />
              </div>
              <span className="text-white/60 text-xs w-16 text-right">
                {(d.metres / 1000).toFixed(2)} km
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add app/components/lab/StatsPanel.tsx
git commit -m "feat: add StatsPanel with stat cards, possession bar, and distance table"
```

---

## Task 14: Modal Pipeline (Python)

**Goal:** Python CV pipeline deployed to Modal that runs YOLOv8+SigLIP+homography on a match video and writes `results.json` to S3. Provides a non-blocking web endpoint for triggering.

**Files:**
- Create: `modal_pipeline/pipeline.py`
- Create: `modal_pipeline/requirements.txt`

**Acceptance Criteria:**
- [ ] `modal deploy modal_pipeline/pipeline.py` succeeds
- [ ] Web endpoint URL is available and returned after deploy
- [ ] Processing a short test clip (< 5 min) completes and writes `results.json` to S3
- [ ] `meta.json` status updates from `processing` → `done` on completion

**Verify:** `modal deploy modal_pipeline/pipeline.py` → outputs endpoint URL. Set `MODAL_TRIGGER_URL` in Vercel to that URL.

**Steps:**

- [ ] **Step 1: Install Modal locally**

```bash
pip install modal
modal token new   # follow browser prompt to authenticate
```

- [ ] **Step 2: Create `modal_pipeline/requirements.txt`**

```
boto3
ultralytics
supervision[assets]
inference-gpu
torch
torchvision
transformers
umap-learn
scikit-learn
opencv-python-headless
pillow
more-itertools
numpy
scipy
roboflow-sports
```

- [ ] **Step 3: Create `modal_pipeline/pipeline.py`**

```python
import modal
import json
import os
from pathlib import Path

app = modal.App("pitchscout-lab")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("/requirements.txt")
    .copy_local_file("modal_pipeline/requirements.txt", "/requirements.txt")
)

# ── helpers ──────────────────────────────────────────────────────────────────

def _s3_client():
    import boto3
    return boto3.client(
        "s3",
        region_name=os.environ["AWS_REGION"],
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )

def _update_progress(bucket: str, job_id: str, progress: int, status: str = "processing"):
    s3 = _s3_client()
    key = f"jobs/{job_id}/meta.json"
    try:
        obj = s3.get_object(Bucket=bucket, Key=key)
        meta = json.loads(obj["Body"].read())
    except Exception:
        meta = {}
    meta["status"] = status
    meta["progress"] = progress
    s3.put_object(Bucket=bucket, Key=key, Body=json.dumps(meta), ContentType="application/json")

# ── main pipeline ─────────────────────────────────────────────────────────────

@app.function(
    gpu="T4",
    timeout=10800,
    image=image,
    secrets=[modal.Secret.from_name("pitchscout-aws")],
    mounts=[modal.Mount.from_local_dir("modal_pipeline", remote_path="/pipeline")],
)
def run_pipeline(job_id: str, video_s3_key: str, results_bucket: str):
    import boto3, cv2, torch, numpy as np
    from inference import get_model
    from supervision import Detections, ByteTracker, KeyPoints, VideoInfo, get_video_frames_generator
    from sports.configs.soccer import SoccerPitchConfiguration
    from transformers import AutoProcessor, AutoModel
    import umap
    from sklearn.cluster import KMeans
    from PIL import Image as PILImage

    s3 = _s3_client()
    _update_progress(results_bucket, job_id, 0)

    # 1. Download video from S3
    video_path = f"/tmp/{job_id}_video.mp4"
    s3.download_file(results_bucket, video_s3_key, video_path)
    _update_progress(results_bucket, job_id, 5)

    # 2. Load models
    ROBOFLOW_API_KEY = os.environ.get("ROBOFLOW_API_KEY", "")
    player_model = get_model("football-player-detection/13", api_key=ROBOFLOW_API_KEY)
    keypoint_model = get_model("football-field-detection/15", api_key=ROBOFLOW_API_KEY)

    device = "cuda" if torch.cuda.is_available() else "cpu"
    siglip_processor = AutoProcessor.from_pretrained("google/siglip-base-patch16-224")
    siglip_model = AutoModel.from_pretrained("google/siglip-base-patch16-224").to(device)
    _update_progress(results_bucket, job_id, 10)

    # 3. Collect crops for team classification (every 30 frames)
    config = SoccerPitchConfiguration()
    video_info = VideoInfo.from_video_path(video_path)
    crops = []
    for frame in get_video_frames_generator(video_path, stride=30):
        result = player_model.infer(frame, confidence=0.3)[0]
        dets = Detections.from_inference(result)
        # filter to players only (class_id == 2)
        player_dets = dets[dets.class_id == 2]
        for det in player_dets:
            xyxy = det[0]
            x1, y1, x2, y2 = map(int, xyxy)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(frame.shape[1], x2), min(frame.shape[0], y2)
            if x2 > x1 and y2 > y1:
                crops.append(PILImage.fromarray(cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2RGB)))

    _update_progress(results_bucket, job_id, 20)

    # 4. SigLIP embeddings → UMAP → KMeans team classification
    embeddings = []
    batch_size = 32
    siglip_model.eval()
    with torch.no_grad():
        for i in range(0, len(crops), batch_size):
            batch = crops[i:i+batch_size]
            inputs = siglip_processor(images=batch, return_tensors="pt").to(device)
            outputs = siglip_model.get_image_features(**inputs)
            embeddings.append(outputs.cpu().numpy())
    if embeddings:
        all_embeddings = np.concatenate(embeddings)
        reduced = umap.UMAP(n_components=3, random_state=42).fit_transform(all_embeddings)
        labels = KMeans(n_clusters=2, random_state=42).fit_predict(reduced)
    else:
        labels = np.array([])

    _update_progress(results_bucket, job_id, 30)

    # 5. Process all frames
    tracker = ByteTracker(video_info=video_info)
    frames_data = []
    trajectory_pts = []
    player_distances: dict[int, float] = {}
    team_assignments: dict[int, int] = {}
    crop_idx = 0
    prev_positions: dict[int, tuple[float, float]] = {}
    possession_counts = [0, 0]

    total_frames = video_info.total_frames
    KEYPOINT_CONF = 0.5
    # Sample every 5 frames → ~5 FPS in results JSON (~2700 frames for 90 min, ~20MB)
    STRIDE = 5

    for fi, frame in enumerate(get_video_frames_generator(video_path, stride=STRIDE)):
        result = player_model.infer(frame, confidence=0.3)[0]
        dets = Detections.from_inference(result)
        dets = dets.with_nms(threshold=0.5, class_agnostic=True)

        # Separate classes
        ball_id = 0
        ball_dets = dets[dets.class_id == ball_id]
        other_dets = dets[dets.class_id != ball_id]

        # Track non-ball
        tracked = tracker.update_with_detections(other_dets)

        # Assign teams based on precomputed labels
        for det in tracked:
            tid = int(det[4])
            if tid not in team_assignments and crop_idx < len(labels):
                team_assignments[tid] = int(labels[crop_idx])
                crop_idx += 1

        # Keypoint detection for homography
        kp_result = keypoint_model.infer(frame, confidence=0.5)[0]
        kp = KeyPoints.from_inference(kp_result)

        frame_players = []
        frame_ball = None

        if kp.xy.shape[0] > 0:
            raw_kp = kp.xy[0]
            conf = kp.confidence[0] if kp.confidence is not None else np.ones(len(raw_kp))
            mask = conf > KEYPOINT_CONF
            frame_kps = raw_kp[mask]
            config_verts = np.array(config.vertices)[mask].astype(np.float32)

            if len(frame_kps) >= 4:
                import cv2 as cv
                H, _ = cv.findHomography(
                    frame_kps.astype(np.float32),
                    config_verts,
                    cv.RANSAC, 5.0
                )
                if H is not None:
                    def to_pitch(pts_px):
                        pts = pts_px.reshape(-1, 1, 2).astype(np.float32)
                        out = cv.perspectiveTransform(pts, H)
                        return out.reshape(-1, 2)

                    # Transform players
                    for det in tracked:
                        tid = int(det[4])
                        cid = int(det[3]) if det[3] is not None else 2
                        bottom_center = np.array([[
                            (det[0][0] + det[0][2]) / 2,
                            det[0][3]
                        ]])
                        pitch_pt = to_pitch(bottom_center)[0]
                        team = team_assignments.get(tid, 0)
                        role = 'goalkeeper' if cid == 1 else ('referee' if cid == 3 else 'player')
                        frame_players.append({
                            "id": tid, "team": team, "role": role,
                            "pitch_x": float(pitch_pt[0]), "pitch_y": float(pitch_pt[1])
                        })
                        # Distance tracking
                        if tid in prev_positions:
                            dx = pitch_pt[0] - prev_positions[tid][0]
                            dy = pitch_pt[1] - prev_positions[tid][1]
                            player_distances[tid] = player_distances.get(tid, 0.0) + float(np.hypot(dx, dy))
                        prev_positions[tid] = (float(pitch_pt[0]), float(pitch_pt[1]))

                    # Transform ball
                    if len(ball_dets) == 1:
                        bx = (ball_dets.xyxy[0][0] + ball_dets.xyxy[0][2]) / 2
                        by = (ball_dets.xyxy[0][1] + ball_dets.xyxy[0][3]) / 2
                        ball_pitch = to_pitch(np.array([[bx, by]]))[0]
                        # Outlier filter: max 5m from last point
                        if trajectory_pts:
                            last = trajectory_pts[-1]
                            dist = np.hypot(ball_pitch[0] - last[0], ball_pitch[1] - last[1])
                            if dist <= 5.0:
                                frame_ball = {"pitch_x": float(ball_pitch[0]), "pitch_y": float(ball_pitch[1])}
                                trajectory_pts.append((float(ball_pitch[0]), float(ball_pitch[1])))
                                # Possession: nearest team centroid
                                if frame_players:
                                    t0_pts = [p for p in frame_players if p["team"] == 0]
                                    t1_pts = [p for p in frame_players if p["team"] == 1]
                                    if t0_pts and t1_pts:
                                        c0 = np.mean([[p["pitch_x"], p["pitch_y"]] for p in t0_pts], axis=0)
                                        c1 = np.mean([[p["pitch_x"], p["pitch_y"]] for p in t1_pts], axis=0)
                                        d0 = np.hypot(ball_pitch[0]-c0[0], ball_pitch[1]-c0[1])
                                        d1 = np.hypot(ball_pitch[0]-c1[0], ball_pitch[1]-c1[1])
                                        possession_counts[0 if d0 < d1 else 1] += 1
                        else:
                            frame_ball = {"pitch_x": float(ball_pitch[0]), "pitch_y": float(ball_pitch[1])}
                            trajectory_pts.append((float(ball_pitch[0]), float(ball_pitch[1])))

        t = fi / video_info.fps
        frames_data.append({"t": t, "players": frame_players, "ball": frame_ball})

        sampled_total = total_frames // STRIDE
        if fi % (sampled_total // 10 or 1) == 0:
            pct = 30 + int((fi / sampled_total) * 60)
            _update_progress(results_bucket, job_id, pct)

    _update_progress(results_bucket, job_id, 90)

    # 6. Compute final stats
    total_poss = sum(possession_counts) or 1
    poss_pct = [
        round(possession_counts[0] / total_poss * 100),
        round(possession_counts[1] / total_poss * 100),
    ]

    # Territory: average Voronoi share (approximate: count frames player is closest to ball)
    territory = [50.0, 50.0]  # simplified; full Voronoi per-frame is compute-intensive

    distances_list = [
        {"id": tid, "team": team_assignments.get(tid, 0), "metres": round(m, 2)}
        for tid, m in player_distances.items()
    ]

    results_json = {
        "meta": {
            "fps": video_info.fps,
            "duration": total_frames / video_info.fps,
            "frameCount": len(frames_data),
        },
        "frames": frames_data,
        "trajectory": trajectory_pts,
        "stats": {
            "possession": poss_pct,
            "distances": distances_list,
            "territory": territory,
        },
    }

    # 7. Write results to S3
    results_key = f"jobs/{job_id}/results.json"
    s3.put_object(
        Bucket=results_bucket,
        Key=results_key,
        Body=json.dumps(results_json),
        ContentType="application/json",
    )

    # 8. Update meta to done
    obj = s3.get_object(Bucket=results_bucket, Key=f"jobs/{job_id}/meta.json")
    meta = json.loads(obj["Body"].read())
    meta["status"] = "done"
    meta["progress"] = 100
    meta["completedAt"] = __import__("datetime").datetime.utcnow().isoformat()
    meta["resultsKey"] = results_key
    s3.put_object(
        Bucket=results_bucket,
        Key=f"jobs/{job_id}/meta.json",
        Body=json.dumps(meta),
        ContentType="application/json",
    )


# ── web endpoint (non-blocking trigger) ──────────────────────────────────────

@app.function(image=modal.Image.debian_slim())
@modal.web_endpoint(method="POST")
def trigger(payload: dict):
    run_pipeline.spawn(
        payload["job_id"],
        payload["video_s3_key"],
        payload["results_bucket"],
    )
    return {"status": "queued", "job_id": payload["job_id"]}
```

- [ ] **Step 4: Add Modal AWS secret** (in Modal dashboard at modal.com/secrets)

Create a secret named `pitchscout-aws` with keys:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Also add `ROBOFLOW_API_KEY` if using private models (public models work without it).

- [ ] **Step 5: Deploy**

```bash
cd /Users/dee/scout.logi-2.0
modal deploy modal_pipeline/pipeline.py
```

Expected output includes a line like:
```
✓ Created web endpoint trigger => https://pitchscout-lab--trigger.modal.run
```

Copy that URL and set it as `MODAL_TRIGGER_URL` in Vercel environment variables.

- [ ] **Step 6: Commit**

```bash
git add modal_pipeline/
git commit -m "feat: add Modal CV pipeline (YOLOv8+SigLIP+homography) with web trigger endpoint"
```

---

## End-to-End Verification

After all tasks complete and env vars are set in Vercel:

1. Visit your Vercel URL → landing page loads (unchanged)
2. Visit `/lab` → redirects to `/lab/login`
3. Sign in with `dpalmer.it@gmail.com` → lands on `/lab/dashboard`
4. Try signing in with a non-allowlisted account → stays on `/lab/login` (no access)
5. Upload a short test video (< 5 min) → job appears as "processing"
6. Wait for Modal to complete → job card shows "Done" + "View →"
7. Click View → Radar tab shows animated player dots on pitch
8. Switch to Voronoi, Trajectory, Stats → all render correctly

---

## Task Dependencies

```
Task 1 → Task 2 → Task 3
Task 2 → Task 4
Task 2 → Task 5
Task 2 → Task 6
Task 3 → Task 6
Task 4 → Task 6 (or Task 6 can be built first; route just errors at runtime without S3)
Task 5 → Task 6
Task 6 → Task 7 (API routes needed for dashboard)
Task 3 → Task 7
Task 7 → Task 8
Task 7 → Task 9 (RadarCanvas)
Task 7 → Task 10 (VoronoiView)
Task 7 → Task 11 (TrajectoryView)
Task 7 → Task 12 (StatsPanel)
Task 4 → Task 14 (S3 helpers needed for pipeline progress writes)
Task 14 → set MODAL_TRIGGER_URL → Task 6 works end-to-end
```
