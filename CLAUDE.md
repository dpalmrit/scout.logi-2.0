# ScoutLogi 2.0 — Claude Code Project

This is the redesigned PitchScout AI landing page. Built with Next.js 14, Tailwind CSS, and Outfit font using the design-taste-frontend skill (DESIGN_VARIANCE=8, MOTION_INTENSITY=6, VISUAL_DENSITY=4).

---

## Key URLs

| Resource | Value |
|----------|-------|
| GitHub repo | `https://github.com/dpalmrit/scout.logi-2.0` |
| Live preview | `https://dpalmrit.github.io/scout.logi-2.0/` |
| Production site (DO NOT touch without approval) | `https://pitchscout.ai` |
| S3 bucket (production) | `pitchscout-frontend-485231031194` |
| CloudFront distribution (production) | `E273GLVTYKNEMG` |

---

## Deployment Rules

- **GitHub Pages** (`dpalmrit.github.io/scout.logi-2.0`) — auto-deploys on every push to `main` via GitHub Actions
- **pitchscout.ai** — NEVER deploy here without an explicit approval from the user. Stage on GitHub Pages first.

---

## Tech Stack

- Next.js 14 (`output: 'export'` static mode)
- Tailwind CSS v3
- Outfit font via `next/font/google`
- `@phosphor-icons/react` — no emojis anywhere
- `basePath: '/scout.logi-2.0'` set for GitHub Pages path

---

## Project Structure

```
app/
  layout.tsx          — Outfit font, metadata
  page.tsx            — Section assembly
  globals.css         — Pitch grid texture, float + reveal keyframes
  components/
    Nav.tsx           — 'use client' — hamburger toggle, glassmorphic
    Hero.tsx          — Split-screen 55/45, floating analysis card (#7, B+)
    HowItWorks.tsx    — Vertical numbered steps (not 3-col cards), YouTube embed
    SampleAnalysis.tsx — Bento metrics grid, 4 observation cards
    EarlyAccess.tsx   — 2-col split: headline + trust checklist
    Footer.tsx        — Minimal, 3-col
    ScrollReveal.tsx  — 'use client' — IntersectionObserver fade-in
```

---

## Design Decisions

- **No emojis** — all replaced with Phosphor icons (IdentificationCard, Upload, ChartBar, TrendUp, TrendDown, Lightbulb, CheckCircle, ArrowRight)
- **No 3-column card layout** — How It Works uses vertical numbered list (01/02/03)
- **Asymmetric hero** — split-screen, not centered (DESIGN_VARIANCE=8 rule)
- **gap-[1px] bento** — metrics grid uses `gap: 1px` with green bg to create separator lines
- **Server components** — no `onMouseEnter`/`onMouseLeave` in server components; all hover via Tailwind `hover:` classes
- **float-card CSS animation** — hero analysis card floats with CSS keyframes, no JS

---

## PitchScout Lab — Required Vercel Environment Variables

These must be set in the Vercel project dashboard (Settings > Environment Variables) for the Lab feature to function:

| Variable | Purpose |
|----------|---------|
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret from Google Cloud Console |
| `NEXTAUTH_SECRET` | Random secret for NextAuth JWT signing (generate with `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Full canonical URL of the deployment (e.g. `https://pitchscout.ai`) |
| `AWS_REGION` | AWS region for the S3 bucket (e.g. `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | IAM key with `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` on the lab bucket |
| `AWS_SECRET_ACCESS_KEY` | Corresponding IAM secret |
| `PITCHSCOUT_LAB_BUCKET` | S3 bucket name for Lab job storage |
| `MODAL_TRIGGER_URL` | HTTP endpoint that triggers the Modal analysis pipeline |

---

## Session History

- **2026-05-20** — Initial build and deployment
  - Built full Next.js landing page (design-taste-frontend skill)
  - Fixed RSC build error: event handlers in server components → replaced with Tailwind hover classes
  - Deployed to pitchscout.ai accidentally → immediately reverted
  - Made repo public, enabled GitHub Pages via Actions
  - Live at `dpalmrit.github.io/scout.logi-2.0/`
