<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Captionovo — Agent Guide

Cloud web app for transcription, subtitles, and creator repurposing. MVP focus: English, Hindi, and Hinglish.

## Repo structure

```
Captionovo/
├── frontend/          # Next.js 16 App Router (UI + Supabase Auth client)
├── backend/           # Python 3.13 + FastAPI API (port 4000) + Supabase admin client
├── scripts/           # OAuth setup helpers
├── .env               # Google OAuth creds (root, gitignored)
└── package.json       # npm workspaces root
```

## Supabase project

| Field | Value |
|-------|-------|
| Name | captionovo |
| Ref | `zzxsxccapuwefkvqixad` |
| Region | ap-south-1 (Mumbai) |
| URL | `https://zzxsxccapuwefkvqixad.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad |

Use Supabase MCP (`user-supabase`) for migrations, SQL, types, and project inspection.

---

## What has been built

### 1. Product UI shell (frontend)

Full screen map from the user journey doc — all routes navigable:

| Screen | Route |
|--------|-------|
| Login / Signup | `/login`, `/signup` |
| Dashboard | `/dashboard` |
| New Upload | `/upload` |
| Processing | `/projects/[id]/processing` |
| Editor — Transcript | `/projects/[id]` |
| Subtitles | `/projects/[id]/subtitles` |
| Repurpose | `/projects/[id]/repurpose` |
| Export | `/projects/[id]/export` |
| Project Settings | `/projects/[id]/settings` |
| Billing | `/billing` |
| Account Settings | `/settings` |

Stack: Next.js 16, TypeScript, Tailwind CSS 4, Lucide icons.

### 2. Supabase database (applied via MCP)

**Tables:** `profiles`, `projects`, `speakers`, `transcript_segments`, `subtitle_segments`, `repurpose_outputs`, `exports`, `credit_transactions`

**Enums:** language, media type, project/processing/export status, transcript mode, etc.

**RLS:** enabled on all public tables — users only access their own data.

**Storage buckets:** `uploads` (source media), `exports` (generated files)

**Auth trigger:** auto-creates `profiles` row on signup (60 free minutes default).

**Google OAuth:** custom OIDC provider `custom:google` registered in `auth.custom_oauth_providers`.

Local migration references: `backend/supabase/migrations/`

### 3. Backend API (FastAPI + Supabase)

Runs at `http://localhost:4000`. Python 3.13, FastAPI, supabase-py. All routes except `/health` and `/billing/webhook` require `Authorization: Bearer <supabase_access_token>`.

| Method | Route | Description | Status |
|--------|-------|-------------|--------|
| GET | `/health` | Health check | Live |
| GET/PATCH | `/profile` | User profile + usage | Live |
| GET/POST | `/projects` | List / create projects | Live |
| GET/PATCH/DELETE | `/projects/:id` | Project CRUD | Live |
| POST | `/projects/:id/upload-url` | Signed storage upload URL | Live |
| POST | `/projects/:id/confirm-upload` | Verify upload, probe, reserve credits | Live |
| POST | `/projects/:id/process` | Idempotent pipeline enqueue | Live (Deepgram when `TRANSCRIPTION_PROVIDER=deepgram`) |
| GET | `/projects/:id/processing-events` | Processing timeline | Live |
| GET | `/projects/:id/transcript` | Transcript segments + speakers | Live |
| PATCH | `/projects/:id/transcript/segments/:segmentId` | Edit transcript segment | Live |
| PATCH | `/projects/:id/speakers/:speakerId` | Rename speaker | Live |
| GET/POST | `/projects/:id/exports` | List / queue exports | Stub |
| GET | `/billing/transactions` | Credit history | Live |
| GET | `/billing/packs` | Credit packs | Live |
| POST | `/billing/checkout` | Stripe checkout | Stub (501) |
| POST | `/billing/webhook` | Stripe webhook | Stub (501) |

**Architecture scaffold (code):** pipeline orchestrator, job queue, provider interfaces, credits/billing services, worker entry (`npm run worker`).

Key files: `backend/src/captionovo/main.py`, `backend/src/captionovo/routes/`, `backend/src/captionovo/pipeline/`, `backend/src/captionovo/jobs/`, `backend/src/captionovo/services/`

Docs: `backend/ARCHITECTURE.md`, `backend/docs/transcriber-and-billing-architecture.docx`, `captionovo_end_to_end_architecture_improvements.docx`

### 4. Auth & API wiring (frontend)

- **Supabase Auth** via `@supabase/ssr` (browser + server clients)
- **Middleware** protects `/dashboard`, `/upload`, `/projects`, etc.
- **Auth callback** at `/auth/callback` (OAuth + email confirmation)
- **Email/password** login and signup
- **Google OAuth** via `signInWithGoogle()` → provider `custom:google`
- **API client** (`frontend/src/lib/api/`) forwards session token to backend
- All app pages fetch live data from backend (mock data replaced)

### 5. Upload flow (Sprint 1) + real STT (Sprint 2)

1. User selects file on `/upload`
2. `POST /projects` creates project in **draft** (no credit check)
3. `POST /projects/:id/upload-url` → signed upload to `…/source/{file}`
4. Frontend uploads to Supabase Storage
5. `POST /projects/:id/confirm-upload` → verify file, **FFmpeg duration probe**, reserve credits
6. `POST /projects/:id/process` → extract audio (FFmpeg) → Deepgram Nova-3 → persist transcript
7. Redirect to `/projects/:id/processing` (polls events)

**Sprint 2 requirements:** FFmpeg on PATH (`ffmpeg`, `ffprobe`), `DEEPGRAM_API_KEY`, `TRANSCRIPTION_PROVIDER=deepgram` in `backend/.env`.

---

## Environment setup

### Frontend — `frontend/.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://zzxsxccapuwefkvqixad.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key from Supabase Dashboard → API>
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Production: set `NEXT_PUBLIC_API_URL` to your backend URL.

### Backend — `backend/.env`

```env
PORT=4000
SUPABASE_URL=https://zzxsxccapuwefkvqixad.supabase.co
SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key — never expose to frontend>
CORS_ORIGIN=http://localhost:3000
TRANSCRIPTION_PROVIDER=deepgram
DEEPGRAM_API_KEY=<from Deepgram dashboard>
# FFMPEG_PATH=ffmpeg
# FFPROBE_PATH=ffprobe
```

Keys: [Supabase Dashboard → Settings → API](https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad/settings/api)

Production: `CORS_ORIGIN=https://<your-vercel-domain>`

### Root — `.env` (optional, gitignored)

Google OAuth credentials for setup scripts:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

---

## Google OAuth configuration

**App uses Supabase Auth**, not NextAuth. Google redirect URI must be:

```
https://zzxsxccapuwefkvqixad.supabase.co/auth/v1/callback
```

NOT `/api/auth/callback/google` on your domain.

**Google Cloud Console:**

| Setting | Value |
|---------|-------|
| JavaScript origins | `http://localhost:3000`, `https://<production-domain>` |
| Redirect URIs | `https://zzxsxccapuwefkvqixad.supabase.co/auth/v1/callback` |

**Supabase URL Configuration:**

| Setting | Value |
|---------|-------|
| Site URL | production domain (or `http://localhost:3000` for dev) |
| Redirect URLs | `http://localhost:3000/auth/callback`, `https://<production-domain>/auth/callback` |

Setup scripts (from repo root):

- `npm run enable:google-oauth` — Admin API (needs `SUPABASE_SERVICE_ROLE_KEY`)
- `npm run configure:google-oauth` — Management API (needs `SUPABASE_ACCESS_TOKEN`)

---

## Dev commands

```bash
npm install
npm run dev          # frontend → :3000
npm run dev:be       # backend  → :4000 (uvicorn + FastAPI)
npm run worker       # optional job poller (Python)
npm run build        # frontend production build
```

Both servers must run for full functionality (frontend calls backend API).

---

## Implementation roadmap

**Last updated:** 2026-06-28  
**Current focus:** Phase 2 benchmark + Phase 3 prep (Sprint 2 wrap-up)  
**Sprint status:** Sprint 1 complete · Sprint 2 in progress (core STT shipped)  
**Source of truth for design:** `captionovo_end_to_end_architecture_improvements.docx`

> **Agent instruction:** After **every** code change that ships or alters behavior, update docs in the same task — do not defer. Check off roadmap tasks (`[x]` / `[~]`), bump **Last updated**, set **Current focus** and **Sprint status**, and sync the API table in **What has been built**. See `.cursor/rules/update-docs-after-changes.mdc`. Do not remove completed items.

### Progress legend

| Label | Meaning |
|-------|---------|
| `[x]` | Done |
| `[ ]` | Not started |
| `[~]` | Partially done / scaffold only |

### Guiding principles

1. Complete **Phase 1 (P0.1)** before real STT — billing and job flow must be correct first.
2. One migration batch per phase; apply via Supabase MCP.
3. Keep stub provider until Phase 2 validates the new upload/billing flow end-to-end.
4. Persist transcript immediately after STT; later stages are retryable and partially completable.

---

### Phase 0 — Foundation cleanup

**Goal:** Align repo and DB with improved architecture baseline.

- [x] Apply `backend/supabase/migrations/20260622100000_sprint1_p01_safety.sql` (via Supabase MCP)
- [x] Backend architecture scaffold (pipeline, jobs, providers stub, services)
- [x] `backend/ARCHITECTURE.md` + architecture DOCX
- [ ] Regenerate DOCX after Phase 1 changes
- [x] Env vars in `backend/.env.example`: `DEEPGRAM_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

**Exit criteria:** `processing_jobs` + `credit_packs` live in Supabase; types match schema.

---

### Phase 1 — P0.1 Backend safety (Sprint 1) ✅

**Goal:** Safe upload → reserve credits → idempotent process → visible progress.  
**Status:** Complete (2026-06-28).

#### Schema

- [x] `profiles.credits_reserved`
- [x] `credit_transactions.idempotency_key` + types: `reserve`, `release`, `usage`, …
- [x] `processing_events` table
- [x] `project_files` table
- [x] `processing_jobs.idempotency_key`, `locked_at`, `locked_by`, `last_error`
- [x] Project upload lifecycle: `draft` → `ready_to_process`

#### Services

- [x] `CreditsService` — `reserve()`, `release()`, `commitFromReservation()`, idempotency
- [x] `UploadService` — verify Storage object, MIME allowlist, size limits
- [x] `MediaProbeService` — duration probe stub (FFmpeg in Phase 2)
- [x] `ProcessingEventsService` — emit stage timeline

#### API

- [x] `POST /projects` — create in **draft**; no credit check at create
- [x] `POST /projects/:id/upload-url` — `uploads/{userId}/{projectId}/source/{file}`
- [x] **`POST /projects/:id/confirm-upload`** — verify, probe, reserve credits
- [x] `POST /projects/:id/process` — idempotent enqueue; gate on `ready_to_process`
- [x] **`GET /projects/:id/processing-events`**
- [x] **`GET /projects/:id/transcript`**

#### Pipeline

- [x] `persisting_transcript` stage after STT; `preparing_editor` for export rows only
- [x] Failure matrix: critical fail → release; optional fail → `partial` + commit if transcript saved
- [x] Release reservation on failure when no transcript persisted

#### Frontend

- [x] `confirmUpload()` in `frontend/src/lib/api/client.ts`
- [x] `upload-form.tsx` — confirm-upload between upload and process
- [x] `ProcessingStatus` client component — polls project + processing-events

**Exit criteria:** No double-charge on retry; insufficient credits fail at confirm-upload; processing page shows stages.

---

### Phase 2 — P0.2 Real transcription (Sprint 2)

**Goal:** Real audio in → real transcript out (English, Hindi, Hinglish).

- [x] `FfmpegMediaProcessor` — extract audio, probe duration, write `project_files` (`providers/ffmpeg.py`)
- [x] `DeepgramTranscriptionProvider` (Nova-3, batch mode) (`providers/deepgram.py`)
- [x] Env: `TRANSCRIPTION_PROVIDER=deepgram`, `DEEPGRAM_API_KEY`, `FFMPEG_PATH` / `FFPROBE_PATH`
- [x] Normalize provider output → internal format only (`normalize_deepgram_response`)
- [x] Real duration probe at confirm-upload via FFmpeg (`MediaProbeService.probe_bytes`)
- [x] Extracted audio persisted to Storage + `project_files.extracted_audio`
- [ ] OpenAI fallback provider (optional, same interface)
- [ ] Benchmark: 10 EN + 10 HI + 10 Hinglish samples (WER, timing, cost, failure rate)

**Exit criteria:** Real upload → editable transcript; credits match probed duration.

**Default provider:** Deepgram Nova-3 (see architecture improvements doc).

---

### Phase 3 — P0.3 Speakers, subtitles, exports (Sprint 3)

**Goal:** Full transcription loop without MP4 burn-in.

- [ ] Real diarization (Deepgram native or separate pass)
- [ ] Subtitle chunking → `subtitle_segments`
- [ ] SRT/VTT writers → `exports` bucket + `project_files`
- [ ] Export worker (`job_type: export_generation`) — TXT, DOCX, PDF
- [ ] `completed_partial` + per-stage retry
- [ ] Signed download URLs for ready exports
- [ ] Frontend export tab — poll status, download when ready

**Exit criteria:** Edit transcript, download SRT/TXT, speaker labels on multi-speaker audio.

---

### Phase 4 — P0.4 Billing (Sprint 4)

**Goal:** Users can buy credits safely.

- [ ] Stripe products/prices aligned with `credit_packs`
- [ ] `POST /billing/checkout` — Checkout Session + `stripe_customer_id` on profile
- [ ] `POST /billing/webhook` — signature verify + `billing_events` (`stripe_event_id` UNIQUE)
- [ ] `grantCredits()` with webhook idempotency
- [ ] Frontend “Buy credits” → checkout → success redirect
- [ ] Transaction history shows reserve/release/usage/purchase

**Exit criteria:** Test purchase grants credits once; duplicate webhook ignored.

---

### Phase 5 — P1 Creator features

- [ ] Editor autosave — bulk PATCH segments/subtitles
- [ ] Split/merge transcript segments
- [ ] `POST /speakers/merge`
- [ ] `POST /subtitles/regenerate` from updated transcript
- [ ] Burned MP4 — FFmpeg subtitle burn-in (`rendering_video`)
- [ ] AI repurpose — summary, chapters, social posts → `repurpose_outputs`
- [ ] Many speakers (15–20): top-N by speaking time; merge/rename UI

---

### Phase 6 — P2 Production

- [ ] Deploy backend (Railway / Fly.io)
- [ ] Deploy worker as separate process
- [ ] Vercel production env (`NEXT_PUBLIC_API_URL`)
- [ ] BullMQ / Inngest if inline queue insufficient
- [ ] Retention cleanup worker (expired source + exports)
- [ ] Rate limits: upload-url, confirm-upload, process, export
- [ ] Processing failure monitoring / alerts
- [ ] Email notification on processing complete (optional)

---

### Dependency order

```
Phase 0 (migrations)           ✅
  → Phase 1 (P0.1 safety)      ✅ Sprint 1 shipped
    → Phase 2 (Deepgram + FFmpeg)  ← CURRENT (Sprint 2 — core STT shipped)
      → Phase 3 (subtitles + exports)
    → Phase 4 (Stripe)             ← can parallel after Phase 1
      → Phase 6 (production)
    → Phase 5 (creator features)     ← after Phase 3
```

---

### Sprint schedule (reference)

| Sprint | Focus | Ship | Status |
|--------|-------|------|--------|
| Sprint 1 | Phase 0 + Phase 1 | Safe upload, reservations, events | ✅ Done |
| Sprint 2 | Phase 2 | Real Deepgram transcription | In progress (core done) |
| Sprint 3 | Phase 3 | Subtitles + file exports | Planned |
| Sprint 4 | Phase 4 + start P1 | Stripe + editor autosave | Planned |
| Sprint 5 | P1 + Phase 6 | MP4 burn-in, deploy | Planned |

---

### Risks

| Risk | Mitigation |
|------|------------|
| Hindi/Hinglish quality | Benchmark before locking single provider |
| FFmpeg in serverless | Run worker on VM/container, not Vercel functions |
| Double billing | Idempotency keys on jobs, credits, Stripe (Phase 1) |
| Large files | Max duration/size at confirm-upload by plan |
| Schema drift | One migration per phase; MCP apply; regenerate types |

---

## Architecture notes

See **`backend/ARCHITECTURE.md`** for the full processing + billing design.

```
Browser → Next.js (frontend)
           ├─ Supabase Auth (login, session cookies)
           └─ Backend API :4000 (Bearer token from session)
                └─ Supabase (Postgres + Storage + service role for uploads)

Processing:
 POST /projects/:id/process → Job Queue → Pipeline Orchestrator → Providers → DB/Storage
 Optional: npm run worker (Python job poller)
```

- Frontend never uses `SUPABASE_SERVICE_ROLE_KEY`
- Backend uses service role only for signed upload URLs and future workers
- User-scoped API calls use the user's JWT via `createUserClient`

---

## Conventions

- Match existing code style in each workspace
- Types: `frontend/src/lib/types.ts` (app)
- API responses use camelCase mappers in `backend/src/captionovo/mappers.py`
- Minimize scope — focused diffs, no over-engineering
- Do not commit secrets (`.env`, service role key, Google secret)
- **Update docs in the same task as code changes** — roadmap, API table, env examples, `ARCHITECTURE.md` when needed (see `.cursor/rules/update-docs-after-changes.mdc`)
