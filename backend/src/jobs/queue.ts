import type { JobStatus, JobType, PipelineJobPayload } from "../domain/processing.js";
import type { AppSupabaseClient } from "../lib/supabase.js";

export interface JobRecord {
  id: string;
  projectId: string;
  userId: string;
  jobType: JobType;
  status: JobStatus;
  payload: PipelineJobPayload;
  attempts: number;
  maxAttempts: number;
}

export interface JobRunner {
  runPipeline(payload: PipelineJobPayload, jobId?: string): Promise<void>;
}

export class JobQueue {
  constructor(
    private readonly admin: AppSupabaseClient,
    private readonly runner: JobRunner,
  ) {}

  async enqueuePipeline(payload: PipelineJobPayload): Promise<{ jobId: string; inline: boolean }> {
    const idempotencyKey = `pipeline:${payload.projectId}`;

    const { data: activeJob } = await this.admin
      .from("processing_jobs")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .in("status", ["queued", "running"])
      .maybeSingle();

    if (activeJob) {
      return { jobId: activeJob.id, inline: false };
    }

    const inserted = await this.tryInsertJob({
      projectId: payload.projectId,
      userId: payload.userId,
      jobType: "project_pipeline",
      payload,
      idempotencyKey,
    });

    if (inserted) {
      void this.runner.runPipeline(payload, inserted.id);
      return { jobId: inserted.id, inline: true };
    }

    void this.runner.runPipeline(payload);
    return { jobId: "inline", inline: true };
  }

  async claimNextJob(): Promise<JobRecord | null> {
    const { data, error } = await this.admin
      .from("processing_jobs")
      .select("*")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    const { data: claimed, error: claimError } = await this.admin
      .from("processing_jobs")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: data.attempts + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("status", "queued")
      .select("*")
      .maybeSingle();

    if (claimError || !claimed) return null;
    return mapJobRecord(claimed);
  }

  async completeJob(jobId: string) {
    await this.admin
      .from("processing_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }

  async failJob(jobId: string, message: string) {
    await this.admin
      .from("processing_jobs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  }

  private async tryInsertJob(input: {
    projectId: string;
    userId: string;
    jobType: JobType;
    payload: PipelineJobPayload;
    idempotencyKey: string;
  }) {
    const { data, error } = await this.admin
      .from("processing_jobs")
      .insert({
        project_id: input.projectId,
        user_id: input.userId,
        job_type: input.jobType,
        status: "queued",
        payload: input.payload,
        current_step: "queued",
        idempotency_key: input.idempotencyKey,
      })
      .select("*")
      .single();

    if (error) {
      console.warn("[jobs] DB queue unavailable, running inline:", error.message);
      return null;
    }

    return mapJobRecord(data);
  }
}

function mapJobRecord(row: Record<string, unknown>): JobRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    userId: String(row.user_id),
    jobType: row.job_type as JobType,
    status: row.status as JobStatus,
    payload: row.payload as PipelineJobPayload,
    attempts: Number(row.attempts ?? 0),
    maxAttempts: Number(row.max_attempts ?? 3),
  };
}

export function startJobPoller(queue: JobQueue, runner: JobRunner, intervalMs = 5000) {
  const timer = setInterval(async () => {
    const job = await queue.claimNextJob();
    if (!job) return;

    try {
      if (job.jobType === "project_pipeline") {
        await runner.runPipeline(job.payload, job.id);
      }
      await queue.completeJob(job.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      await queue.failJob(job.id, message);
    }
  }, intervalMs);

  timer.unref?.();
  return () => clearInterval(timer);
}
