# Captionovo Backend Architecture

This document describes the processing and billing architecture scaffolded in `backend/src/`. Implementation is staged: interfaces and orchestration are in place; external providers (Deepgram, FFmpeg, Stripe) plug in behind them.

## System overview

```mermaid
flowchart TB
  subgraph client [Client]
    FE[Next.js Frontend]
  end

  subgraph api [API Layer - FastAPI :4000]
    Routes[Routes]
    Auth[Auth Middleware]
  end

  subgraph worker [Worker Layer]
    Queue[Job Queue]
    Orchestrator[Pipeline Orchestrator]
    Stages[Pipeline Stages]
  end

  subgraph providers [Provider Layer]
    STT[Transcription Provider]
    Diar[Diarization Provider]
    Media[Media Processor - FFmpeg]
  end

  subgraph data [Supabase]
    DB[(Postgres)]
    Uploads[(uploads bucket)]
    Exports[(exports bucket)]
  end

  subgraph billing [Billing]
    Credits[Credits Service]
    Stripe[Stripe - future]
  end

  FE -->|Bearer JWT| Auth
  Auth --> Routes
  Routes -->|enqueue| Queue
  Queue --> Orchestrator
  Orchestrator --> Stages
  Stages --> STT
  Stages --> Diar
  Stages --> Media
  Stages --> DB
  Stages --> Uploads
  Stages --> Exports
  Orchestrator --> Credits
  Routes --> Credits
  Stripe -.-> Credits
```

## Directory layout

```
backend/src/captionovo/
├── domain/           # Shared types (processing, billing)
├── routes/           # HTTP handlers (thin — delegate to services)
├── jobs/             # Job queue + worker runner
├── pipeline/         # Orchestrator + stage implementations
├── providers/        # Swappable STT / diarization / FFmpeg adapters
├── services/         # Credits ledger, billing (Stripe)
├── worker.py         # Standalone worker entry point
└── (lib modules)     # auth, config, supabase, mappers, storage_paths
```

## Processing pipeline

### Trigger

1. User uploads media → `POST /projects/:id/upload-url`
2. User starts job → `POST /projects/:id/process`
3. API enqueues a `project_pipeline` job (DB row or inline fallback)
4. Worker runs `PipelineOrchestrator.run(payload)`

### Stage graph

Stages are selected from `project.outputs`:

| Output flag | Stages added |
|-------------|--------------|
| always | `extracting_audio` → `detecting_language` → `transcribing` |
| `speaker_labels` | `diarizing_speakers` |
| `subtitles`, `burned_video` | `generating_subtitles` |
| `summary`, `repurpose` | `generating_summary` |
| `burned_video` | `rendering_video` |
| always | `preparing_editor` → `completed` |

Each stage:
- Updates `projects.processing_state`
- Writes domain data (`transcript_segments`, `speakers`, `subtitle_segments`, `exports`)
- Uses provider interfaces (currently **stub** implementations)

### Provider interfaces

| Interface | Responsibility | Current impl |
|-----------|----------------|--------------|
| `TranscriptionProvider` | Speech-to-text | `providers/deepgram` or `providers/stub` |
| `DiarizationProvider` | Speaker assignment | `PassthroughDiarizationProvider` (Deepgram) or `providers/stub` |
| `MediaProcessor` | FFmpeg extract / burn-in | `providers/ffmpeg` or `providers/stub` |

Switch provider via `TRANSCRIPTION_PROVIDER` env (`stub` | `deepgram`). Requires `DEEPGRAM_API_KEY` and FFmpeg on PATH when using `deepgram`.

### Job queue

| Mode | When | How |
|------|------|-----|
| **Inline** | Dev / no migration | Job runs in API process after enqueue |
| **DB queue** | After migration applied | `processing_jobs` table + optional `npm run worker` poller |

Migration: `supabase/migrations/20260621130000_processing_jobs_and_billing.sql`

## Billing architecture

### Credits model

- **1 credit = 1 minute** of source media
- **Reserve** at project create (credit check)
- **Commit** on pipeline success via `CreditsService.commitUsage()`
- **Grant** on purchase via `CreditsService.grantCredits()`

### Ledger

`credit_transactions` records all movements:

| `transaction_type` | Meaning |
|--------------------|---------|
| `usage` | Minutes consumed by a project |
| `purchase` | Stripe checkout completed |
| `bonus` | Promotional grant |
| `refund` | Manual / Stripe refund |
| `adjustment` | Admin correction |

### Billing API

| Method | Route | Auth | Status |
|--------|-------|------|--------|
| GET | `/billing/transactions` | Yes | Live |
| GET | `/billing/packs` | Yes | Live (defaults if no DB) |
| POST | `/billing/checkout` | Yes | Stub → 501 until Stripe |
| POST | `/billing/webhook` | Stripe signature | Stub → 501 until Stripe |

### Stripe integration (next)

1. Create Checkout Session in `BillingService.createCheckoutSession`
2. Webhook `checkout.session.completed` → `grantCredits(userId, pack.credits, 'purchase')`
3. Store `stripe_customer_id` on `profiles`

Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

## Editor & export API

| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/projects/:id/transcript/segments/:segmentId` | Edit transcript |
| PATCH | `/projects/:id/speakers/:speakerId` | Rename speaker |
| GET | `/projects/:id/exports` | List export status |
| POST | `/projects/:id/exports` | Queue export job |

Export generation (`job_type: export`) is stubbed — same queue pattern as pipeline.

## Deployment topology

```
┌─────────────────┐     ┌─────────────────┐
│  API (FastAPI)  │     │  Worker         │
│  npm run dev:be │     │  npm run worker │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
              Supabase (DB + Storage)
```

For production, run API and Worker as separate processes/containers. Both need `SUPABASE_SERVICE_ROLE_KEY`.

## Implementation roadmap

### Phase 1 — Architecture (this PR)
- [x] Pipeline orchestrator + stages
- [x] Provider interfaces + stubs
- [x] Job queue scaffold
- [x] Credits service + billing routes
- [x] Transcript / export route stubs
- [ ] Apply DB migration via Supabase MCP

### Phase 2 — Real transcription
- [x] Deepgram Nova-3 provider (`providers/deepgram.py`) — Hindi/Hinglish via `multi` / `hi` / `en`
- [x] FFmpeg media processor (`providers/ffmpeg.py`) — audio extract, duration probe
- [x] Normalize Deepgram JSON → `TranscriptionResult` only (never leak to DB/frontend)
- [x] Confirm-upload uses ffprobe for credit reservation
- [ ] Word-level timestamps in domain model (optional)
- [ ] Benchmark suite (EN / HI / Hinglish)

### Phase 3 — Subtitles & burn-in
- [ ] Subtitle chunking / line breaking
- [ ] SRT/VTT writers
- [ ] FFmpeg subtitle burn-in → `exports` bucket

### Phase 4 — Billing
- [ ] Stripe Checkout + webhook
- [ ] Wire frontend "Buy credits" button

### Phase 5 — Scale
- [ ] Move queue to BullMQ / Inngest if needed
- [ ] Separate worker autoscaling
- [ ] Processing complete notifications
