import type { Env } from "../lib/env.js";
import { createAdminClient } from "../lib/supabase.js";
import { createProviders } from "../providers/index.js";
import { CreditsService } from "../services/credits.js";
import { ProcessingEventsService } from "../services/processing-events.js";
import { PipelineOrchestrator } from "../pipeline/orchestrator.js";
import type { JobRunner } from "./queue.js";
import { JobQueue } from "./queue.js";
import type { PipelineJobPayload } from "../domain/processing.js";

export function createWorker(env: Env, admin = createAdminClient(env)) {
  const providers = createProviders(env);
  const credits = new CreditsService(admin);
  const events = new ProcessingEventsService(admin);

  const orchestrator = new PipelineOrchestrator({
    env,
    admin,
    providers,
    credits,
    events,
  });

  const runner: JobRunner = {
    async runPipeline(payload: PipelineJobPayload, jobId?: string) {
      if (jobId) {
        await admin
          .from("processing_jobs")
          .update({ current_step: "extracting_audio", status: "running" })
          .eq("id", jobId);
      }

      await orchestrator.run(payload, jobId);

      if (jobId) {
        await admin
          .from("processing_jobs")
          .update({
            status: "completed",
            current_step: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    },
  };

  const queue = new JobQueue(admin, runner);

  return { queue, runner, orchestrator, credits, events };
}
