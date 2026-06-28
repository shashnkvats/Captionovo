"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PROCESSING_STEPS } from "@/lib/constants";
import { apiFetch, type ApiProjectSummary } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { formatDuration } from "@/lib/utils";
import type { ProcessingState } from "@/lib/types";

interface ProcessingEvent {
  id: string;
  stage: string;
  status: string;
  message?: string;
  startedAt: string;
}

function stepIndex(state: ProcessingState | undefined): number {
  if (!state) return 0;
  const idx = PROCESSING_STEPS.findIndex((s) => s.key === state);
  return idx >= 0 ? idx : 0;
}

export function ProcessingStatus({
  projectId,
  initialProject,
}: {
  projectId: string;
  initialProject: ApiProjectSummary;
}) {
  const [project, setProject] = useState(initialProject);
  const [events, setEvents] = useState<ProcessingEvent[]>([]);

  useEffect(() => {
    let active = true;

    async function poll() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !active) return;

      const token = session.access_token;

      try {
        const [projectRes, eventsRes] = await Promise.all([
          apiFetch<{ project: ApiProjectSummary }>(`/projects/${projectId}`, token),
          apiFetch<{ events: ProcessingEvent[] }>(
            `/projects/${projectId}/processing-events`,
            token,
          ),
        ]);

        if (!active) return;
        setProject(projectRes.project);
        setEvents(eventsRes.events);
      } catch {
        // keep last known state while polling
      }
    }

    poll();
    const timer = setInterval(poll, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [projectId]);

  const currentIdx = stepIndex(project.processingState);
  const progress = Math.round(((currentIdx + 1) / PROCESSING_STEPS.length) * 100);
  const isDone = project.status === "completed" || project.status === "partial";
  const isFailed = project.status === "failed";

  return (
    <>
      <div>
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {PROCESSING_STEPS[currentIdx]?.label ?? "Processing"}
          </span>
          <span className="text-zinc-500">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-zinc-500">File</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">{project.fileName}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Duration</dt>
          <dd className="font-medium text-zinc-900 dark:text-zinc-100">
            {formatDuration(project.durationMinutes)}
          </dd>
        </div>
      </dl>

      <ul className="space-y-2">
        {PROCESSING_STEPS.map((step, idx) => {
          const done = idx < currentIdx || isDone;
          const current = idx === currentIdx && !isDone && !isFailed;
          return (
            <li key={step.key} className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
              {done ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : current ? (
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-zinc-300 dark:border-zinc-600" />
              )}
              <span
                className={
                  done
                    ? "text-zinc-500 line-through"
                    : current
                      ? "font-medium text-zinc-900 dark:text-zinc-100"
                      : "text-zinc-400"
                }
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ul>

      {events.length > 0 && (
        <div className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Activity
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-400">
            {events.slice(-8).map((event) => (
              <li key={event.id}>
                <span className="font-medium">{event.stage}</span> — {event.status}
                {event.message ? `: ${event.message}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      {project.status === "partial" && (
        <div className="rounded-lg bg-orange-50 p-4 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">
          Partial success: transcript is ready even though some optional steps failed.
          <Link href={`/projects/${project.id}`} className="ml-1 font-medium underline">
            Open editor
          </Link>
        </div>
      )}

      {project.status === "completed" && (
        <Link href={`/projects/${project.id}`}>
          <Button className="w-full">Open Project Editor</Button>
        </Link>
      )}

      {isFailed && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          Processing failed. Credits were not charged unless a transcript was saved.
        </div>
      )}
    </>
  );
}
