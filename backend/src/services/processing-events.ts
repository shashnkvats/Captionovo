import type { AppSupabaseClient } from "../lib/supabase.js";
import type { Database } from "../types/database.js";

type EventStatus = Database["public"]["Enums"]["processing_event_status"];

export class ProcessingEventsService {
  constructor(private readonly admin: AppSupabaseClient) {}

  async emit(input: {
    projectId: string;
    jobId?: string;
    stage: string;
    status: EventStatus;
    message?: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await this.admin.from("processing_events").insert({
      project_id: input.projectId,
      job_id: input.jobId ?? null,
      stage: input.stage,
      status: input.status,
      message: input.message ?? null,
      metadata: input.metadata ?? {},
      completed_at: input.status === "completed" || input.status === "failed" ? new Date().toISOString() : null,
    });

    if (error) {
      console.warn("[processing-events] failed to emit:", error.message);
    }
  }
}

export function mapProcessingEvent(row: {
  id: string;
  stage: string;
  status: EventStatus;
  message: string | null;
  started_at: string;
  completed_at: string | null;
}) {
  return {
    id: row.id,
    stage: row.stage,
    status: row.status,
    message: row.message ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
  };
}
