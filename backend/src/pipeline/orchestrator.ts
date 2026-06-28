import type { PipelineJobPayload } from "../domain/processing.js";
import {
  buildPipelineStages,
  createPipelineContext,
  disposePipelineContext,
  type PipelineContext,
} from "./context.js";
import { pipelineStages } from "./stages/index.js";
import type { ProviderRegistry } from "../providers/types.js";
import type { AppSupabaseClient } from "../lib/supabase.js";
import type { Env } from "../lib/env.js";
import { CreditsService } from "../services/credits.js";
import { ProcessingEventsService } from "../services/processing-events.js";
import { emitStageEvent } from "./context.js";

export interface PipelineOrchestratorDeps {
  env: Env;
  admin: AppSupabaseClient;
  providers: ProviderRegistry;
  credits: CreditsService;
  events: ProcessingEventsService;
}

export class PipelineOrchestrator {
  constructor(private readonly deps: PipelineOrchestratorDeps) {}

  async run(payload: PipelineJobPayload, jobId?: string) {
    const ctx = await createPipelineContext({ ...this.deps, payload, jobId });
    const plannedSteps = buildPipelineStages(payload.outputs);

    try {
      for (const stepName of plannedSteps) {
        const stage = pipelineStages.find((candidate) => candidate.name === stepName);
        if (!stage || !stage.shouldRun(ctx)) continue;

        try {
          await stage.run(ctx);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Stage failed";
          await emitStageEvent(ctx, stage.name, "failed", message);

          if (stage.critical) {
            throw error;
          }

          ctx.failedStages.push(stage.name);
        }
      }

      await this.markCompleted(ctx, payload);
    } catch (error) {
      await this.markFailed(ctx, payload, error);
      throw error;
    } finally {
      await disposePipelineContext(ctx);
    }
  }

  private async markCompleted(ctx: PipelineContext, payload: PipelineJobPayload) {
    const isPartial = ctx.failedStages.length > 0;

    await ctx.admin
      .from("projects")
      .update({
        processing_state: "completed",
        status: isPartial ? "partial" : "completed",
      })
      .eq("id", payload.projectId);

    if (ctx.hasTranscript) {
      await ctx.credits.commitFromReservation(payload.projectId, payload.userId);
    } else {
      await ctx.credits.release(payload.projectId, payload.userId);
    }

    await ctx.events.emit({
      projectId: payload.projectId,
      jobId: ctx.jobId,
      stage: "pipeline",
      status: "completed",
      message: isPartial ? `Partial completion: ${ctx.failedStages.join(", ")}` : "All stages completed",
    });
  }

  private async markFailed(ctx: PipelineContext, payload: PipelineJobPayload, error: unknown) {
    const message = error instanceof Error ? error.message : "Processing failed";

    await ctx.admin
      .from("projects")
      .update({
        processing_state: "failed",
        status: "failed",
      })
      .eq("id", payload.projectId);

    if (ctx.hasTranscript) {
      await ctx.admin
        .from("projects")
        .update({ status: "partial", processing_state: "transcript_ready" })
        .eq("id", payload.projectId);
      await ctx.credits.commitFromReservation(payload.projectId, payload.userId);
    } else {
      await ctx.credits.release(payload.projectId, payload.userId);
    }

    await ctx.events.emit({
      projectId: payload.projectId,
      jobId: ctx.jobId,
      stage: "pipeline",
      status: "failed",
      message,
    });

    console.error(`[pipeline] project ${payload.projectId} failed:`, message);
  }
}
