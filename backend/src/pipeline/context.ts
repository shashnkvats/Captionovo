import type { OutputOption, PipelineJobPayload, PipelineStageName } from "../domain/processing.js";
import type { TranscriptionResult } from "../domain/processing.js";
import type { ProviderRegistry } from "../providers/types.js";
import type { AppSupabaseClient } from "../lib/supabase.js";
import type { Env } from "../lib/env.js";
import { CreditsService } from "../services/credits.js";
import { ProcessingEventsService } from "../services/processing-events.js";

export interface PipelineContext {
  env: Env;
  admin: AppSupabaseClient;
  payload: PipelineJobPayload;
  providers: ProviderRegistry;
  credits: CreditsService;
  events: ProcessingEventsService;
  jobId?: string;
  workDir: string;
  localMediaPath?: string;
  localAudioPath?: string;
  transcription?: TranscriptionResult;
  failedStages: string[];
  hasTranscript: boolean;
}

export interface PipelineStage {
  name: PipelineStageName;
  critical: boolean;
  shouldRun(ctx: PipelineContext): boolean;
  run(ctx: PipelineContext): Promise<void>;
}

export const CRITICAL_STAGES = new Set<PipelineStageName>([
  "extracting_audio",
  "detecting_language",
  "transcribing",
  "persisting_transcript",
]);

export function buildPipelineStages(outputs: OutputOption[]): PipelineStageName[] {
  const steps: PipelineStageName[] = [
    "extracting_audio",
    "detecting_language",
    "transcribing",
    "persisting_transcript",
  ];

  if (outputs.includes("speaker_labels")) {
    steps.push("diarizing_speakers");
  }

  if (outputs.includes("subtitles") || outputs.includes("burned_video")) {
    steps.push("generating_subtitles");
  }

  if (outputs.includes("summary") || outputs.includes("repurpose")) {
    steps.push("generating_summary");
  }

  if (outputs.includes("burned_video")) {
    steps.push("rendering_video");
  }

  steps.push("preparing_editor");
  return steps;
}

export async function createPipelineContext(deps: {
  env: Env;
  admin: AppSupabaseClient;
  payload: PipelineJobPayload;
  providers: ProviderRegistry;
  credits: CreditsService;
  events: ProcessingEventsService;
  jobId?: string;
}): Promise<PipelineContext> {
  const { mkdir, mkdtemp } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");

  const workDir = await mkdtemp(join(tmpdir(), "captionovo-"));
  await mkdir(workDir, { recursive: true });
  return { ...deps, workDir, failedStages: [], hasTranscript: false };
}

export async function disposePipelineContext(ctx: PipelineContext) {
  const { rm } = await import("node:fs/promises");
  await rm(ctx.workDir, { recursive: true, force: true });
}

export async function updateProjectStep(
  admin: AppSupabaseClient,
  projectId: string,
  step: PipelineStageName,
) {
  await admin.from("projects").update({ processing_state: step }).eq("id", projectId);
}

export async function emitStageEvent(
  ctx: PipelineContext,
  stage: string,
  status: "started" | "completed" | "failed",
  message?: string,
) {
  await ctx.events.emit({
    projectId: ctx.payload.projectId,
    jobId: ctx.jobId,
    stage,
    status,
    message,
  });
}
