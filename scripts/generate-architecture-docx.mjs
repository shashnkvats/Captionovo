#!/usr/bin/env node
/**
 * Generates backend/docs/transcriber-and-billing-architecture.docx
 * Run: node scripts/generate-architecture-docx.mjs
 */

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  BorderStyle,
} from "docx";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "backend", "docs");
const OUT_FILE = join(OUT_DIR, "transcriber-and-billing-architecture.docx");

function h1(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 } });
}

function h2(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 } });
}

function h3(text) {
  return new Paragraph({ text, heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 } });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, ...opts })],
  });
}

function bullet(text) {
  return new Paragraph({
    text,
    bullet: { level: 0 },
    spacing: { after: 80 },
  });
}

function mono(lines) {
  return lines.split("\n").map(
    (line) =>
      new Paragraph({
        spacing: { after: 0 },
        children: [new TextRun({ text: line, font: "Courier New", size: 20 })],
      }),
  );
}

function table(headers, rows) {
  const headerCells = headers.map(
    (text) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })],
        shading: { fill: "E8EAF6" },
      }),
  );

  const bodyRows = rows.map(
    (row) =>
      new TableRow({
        children: row.map(
          (text) =>
            new TableCell({
              children: [new Paragraph({ text: String(text) })],
            }),
        ),
      }),
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1 },
      bottom: { style: BorderStyle.SINGLE, size: 1 },
      left: { style: BorderStyle.SINGLE, size: 1 },
      right: { style: BorderStyle.SINGLE, size: 1 },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
      insideVertical: { style: BorderStyle.SINGLE, size: 1 },
    },
  });
}

const doc = new Document({
  title: "Captionovo — Transcriber & Billing Architecture",
  creator: "Captionovo",
  description: "Backend architecture for transcription pipeline and billing",
  sections: [
    {
      properties: {},
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({ text: "Captionovo", bold: true, size: 52, color: "4338CA" }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: "Transcriber & Billing Architecture",
              bold: true,
              size: 36,
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [
            new TextRun({ text: "Backend API · Processing Pipeline · Credits & Stripe", size: 24, color: "666666" }),
          ],
        }),
        p("Document version: 1.0"),
        p("Last updated: June 2026"),
        p("Repository: Captionovo/backend"),

        h1("1. Executive Summary"),
        p(
          "Captionovo is a cloud web application for transcription, subtitles, and creator repurposing (English, Hindi, Hinglish). The backend separates HTTP API concerns from long-running media processing via a job queue and pipeline orchestrator. Billing uses a credits ledger (1 credit = 1 minute) with Stripe integration planned for purchases.",
        ),

        h1("2. System Overview"),
        p(
          "The browser talks to a Next.js frontend for auth (Supabase) and to a Hono API on port 4000 for business logic. Processing jobs are enqueued when a user starts transcription; a worker runs the pipeline through swappable provider adapters.",
        ),
        ...mono(
          "Browser (Next.js)\n  ├─ Supabase Auth (session cookies)\n  └─ Backend API :4000 (Bearer JWT)\n       ├─ Job Queue\n       ├─ Pipeline Orchestrator\n       ├─ Providers (STT / Diarization / FFmpeg)\n       └─ Supabase (Postgres + Storage)\n            ├─ uploads bucket (source media)\n            └─ exports bucket (generated files)",
        ),
        p("Billing flows through CreditsService for usage deduction and BillingService for Stripe purchases (future)."),

        h1("3. Transcriber Architecture"),

        h2("3.1 Directory Layout"),
        ...mono(
          "backend/src/\n├── domain/       Shared types (processing, billing)\n├── routes/       HTTP handlers\n├── jobs/         Job queue + worker runner\n├── pipeline/     Orchestrator + stage implementations\n├── providers/    STT / diarization / FFmpeg adapters\n├── services/     Credits ledger, billing (Stripe)\n├── worker/       Standalone worker entry point\n└── lib/          Auth, env, Supabase, mappers",
        ),

        h2("3.2 Processing Trigger Flow"),
        bullet("User selects file on /upload and creates a project (POST /projects)."),
        bullet("Backend returns a signed upload URL (POST /projects/:id/upload-url)."),
        bullet("Frontend uploads media to Supabase Storage (uploads bucket)."),
        bullet("User starts processing (POST /projects/:id/process)."),
        bullet("API enqueues a project_pipeline job (DB row or inline dev fallback)."),
        bullet("Worker runs PipelineOrchestrator.run(payload) through all applicable stages."),
        bullet("On success: transcript segments, speakers, subtitles, and export rows are persisted; credits are committed."),

        h2("3.3 Pipeline Stage Graph"),
        p("Stages are selected dynamically from project.outputs selected at upload time:"),
        table(
          ["Output flag", "Pipeline stages added"],
          [
            ["(always)", "extracting_audio → detecting_language → transcribing"],
            ["speaker_labels", "diarizing_speakers"],
            ["subtitles, burned_video", "generating_subtitles"],
            ["summary, repurpose", "generating_summary"],
            ["burned_video", "rendering_video"],
            ["(always)", "preparing_editor → completed"],
          ],
        ),
        p("Each stage updates projects.processing_state and writes to the appropriate tables."),

        h3("Stage responsibilities"),
        table(
          ["Stage", "Action"],
          [
            ["extracting_audio", "Download source from Storage; extract audio via FFmpeg"],
            ["detecting_language", "Detect or confirm language (auto / en / hi / Hinglish)"],
            ["transcribing", "Speech-to-text via TranscriptionProvider"],
            ["diarizing_speakers", "Assign speaker labels to segments via DiarizationProvider"],
            ["generating_subtitles", "Build subtitle_segments from transcript; register SRT/VTT exports"],
            ["generating_summary", "LLM repurposing (summary, chapters, social posts) — planned"],
            ["rendering_video", "Burn subtitles into MP4 via FFmpeg → exports bucket"],
            ["preparing_editor", "Persist speakers + transcript_segments; register TXT/DOCX/PDF exports"],
          ],
        ),

        h2("3.4 Provider Interfaces"),
        p("External services plug in behind stable interfaces. Current implementation uses stubs for local development."),
        table(
          ["Interface", "Responsibility", "Current implementation"],
          [
            ["TranscriptionProvider", "Speech-to-text with timestamps", "providers/stub"],
            ["DiarizationProvider", "Speaker assignment per segment", "providers/stub"],
            ["MediaProcessor", "FFmpeg: audio extract, duration probe, subtitle burn-in", "providers/stub"],
          ],
        ),
        p("Switch provider via TRANSCRIPTION_PROVIDER env variable (planned: deepgram, assemblyai)."),

        h2("3.5 Job Queue"),
        table(
          ["Mode", "When used", "How it works"],
          [
            ["Inline", "Dev / migration not applied", "Job runs in API process immediately after enqueue"],
            ["DB queue", "After migration applied", "processing_jobs table + optional npm run worker poller"],
          ],
        ),
        p("Migration file: backend/supabase/migrations/20260621130000_processing_jobs_and_billing.sql"),

        h2("3.6 Data Model (Processing)"),
        table(
          ["Table / bucket", "Purpose"],
          [
            ["projects", "Job metadata, status, processing_state, outputs, storage_path"],
            ["transcript_segments", "Timed transcript lines with optional speaker_id"],
            ["speakers", "Speaker labels and display names per project"],
            ["subtitle_segments", "Timed subtitle lines for editor and export"],
            ["exports", "Export job status per format (SRT, VTT, MP4, TXT, etc.)"],
            ["processing_jobs", "Queue records with payload, status, attempts"],
            ["uploads (Storage)", "Source audio/video files"],
            ["exports (Storage)", "Generated download files"],
          ],
        ),

        h2("3.7 Editor & Export API"),
        table(
          ["Method", "Route", "Purpose"],
          [
            ["PATCH", "/projects/:id/transcript/segments/:segmentId", "Edit transcript text / timing / speaker"],
            ["PATCH", "/projects/:id/speakers/:speakerId", "Rename a speaker"],
            ["GET", "/projects/:id/exports", "List export status per format"],
            ["POST", "/projects/:id/exports", "Queue an export generation job"],
          ],
        ),

        h1("4. Billing Architecture"),

        h2("4.1 Credits Model"),
        bullet("1 credit = 1 minute of source media duration."),
        bullet("Reserve: credit check at project creation (POST /projects). Returns 402 if insufficient."),
        bullet("Commit: CreditsService.commitUsage() on pipeline success — deducts balance and writes ledger row."),
        bullet("Grant: CreditsService.grantCredits() on purchase, bonus, or refund."),

        h2("4.2 Credit Ledger"),
        p("All balance changes are recorded in credit_transactions:"),
        table(
          ["transaction_type", "Meaning"],
          [
            ["usage", "Minutes consumed by a completed project"],
            ["purchase", "Credits bought via Stripe Checkout"],
            ["bonus", "Promotional or signup grant"],
            ["refund", "Manual or Stripe refund"],
            ["adjustment", "Admin correction"],
          ],
        ),

        h2("4.3 Credit Packs"),
        p("Predefined packs stored in credit_packs (or hardcoded defaults until migration is applied):"),
        table(
          ["Pack", "Credits (minutes)", "Price"],
          [
            ["Starter", "120", "$4.99"],
            ["Creator", "600", "$19.99"],
            ["Studio", "1500", "$44.99"],
          ],
        ),

        h2("4.4 Billing API"),
        table(
          ["Method", "Route", "Auth", "Status"],
          [
            ["GET", "/billing/transactions", "Bearer JWT", "Live"],
            ["GET", "/billing/packs", "Bearer JWT", "Live"],
            ["POST", "/billing/checkout", "Bearer JWT", "Stub (501 until Stripe configured)"],
            ["POST", "/billing/webhook", "Stripe signature", "Stub (501 until Stripe configured)"],
          ],
        ),

        h2("4.5 Stripe Integration (Planned)"),
        bullet("User clicks Buy credits → POST /billing/checkout with packId."),
        bullet("Backend creates Stripe Checkout Session; returns checkoutUrl."),
        bullet("On checkout.session.completed webhook → grantCredits(userId, pack.credits, purchase)."),
        bullet("Store stripe_customer_id on profiles for repeat purchases."),
        p("Required environment variables: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET"),

        h2("4.6 Data Model (Billing)"),
        table(
          ["Table / column", "Purpose"],
          [
            ["profiles.credits_remaining", "Current minute balance"],
            ["profiles.stripe_customer_id", "Stripe customer link"],
            ["credit_transactions", "Immutable ledger of all credit movements"],
            ["credit_packs", "Purchasable pack definitions"],
          ],
        ),

        h1("5. Deployment Topology"),
        ...mono(
          "┌─────────────────┐     ┌─────────────────┐\n│  API (Hono)     │     │  Worker         │\n│  npm run dev:be │     │  npm run worker │\n└────────┬────────┘     └────────┬────────┘\n         │                       │\n         └───────────┬───────────┘\n                     ▼\n              Supabase (DB + Storage)",
        ),
        p("Production: run API and Worker as separate processes or containers. Both require SUPABASE_SERVICE_ROLE_KEY."),

        h1("6. Implementation Roadmap"),
        h3("Phase 1 — Architecture (complete)"),
        bullet("Pipeline orchestrator + stages"),
        bullet("Provider interfaces + stubs"),
        bullet("Job queue scaffold"),
        bullet("Credits service + billing routes"),
        bullet("Transcript / export route stubs"),
        bullet("Apply DB migration via Supabase"),

        h3("Phase 2 — Real transcription"),
        bullet("Deepgram or AssemblyAI provider (Hindi / Hinglish tuning)"),
        bullet("FFmpeg media processor (audio extract, duration probe)"),
        bullet("Persist real duration + word-level timestamps"),

        h3("Phase 3 — Subtitles & burn-in"),
        bullet("Subtitle chunking / line breaking"),
        bullet("SRT / VTT writers"),
        bullet("FFmpeg subtitle burn-in → exports bucket"),

        h3("Phase 4 — Billing"),
        bullet("Stripe Checkout + webhook handler"),
        bullet("Wire frontend Buy credits button"),

        h3("Phase 5 — Scale"),
        bullet("Move queue to BullMQ / Inngest if needed"),
        bullet("Separate worker autoscaling"),
        bullet("Processing complete email notifications"),

        h1("7. Security Notes"),
        bullet("Frontend never receives SUPABASE_SERVICE_ROLE_KEY."),
        bullet("User-scoped API calls use the user's JWT via createUserClient."),
        bullet("Service role is used only for signed uploads, workers, and admin operations."),
        bullet("Stripe webhook endpoint validates signature before granting credits."),
        bullet("Row Level Security (RLS) enforced on all user-facing tables."),
      ],
    },
  ],
});

mkdirSync(OUT_DIR, { recursive: true });
const buffer = await Packer.toBuffer(doc);
await import("node:fs/promises").then((fs) => fs.writeFile(OUT_FILE, buffer));
console.log(`Wrote ${OUT_FILE}`);
