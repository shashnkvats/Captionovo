import { ProjectEditorShell } from "@/components/editor/project-editor-shell";
import { Button } from "@/components/ui/button";
import { fetchProject } from "@/lib/api/server";
import { formatTimestamp } from "@/lib/utils";
import { Search, Sparkles } from "lucide-react";

export default async function TranscriptTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);

  const segments = project.segments ?? [];

  return (
    <ProjectEditorShell project={project}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              placeholder="Search transcript..."
            />
          </div>
          <Button variant="secondary" size="sm">
            Find & replace
          </Button>
          <span className="text-xs text-zinc-500 capitalize">
            {project.transcriptMode} mode
          </span>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {segments.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">Transcript not ready yet</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {segments.map((seg) => {
                const speaker = project.speakers?.find((s) => s.id === seg.speakerId);
                const lowConfidence = seg.confidence !== undefined && seg.confidence < 0.9;
                return (
                  <li
                    key={seg.id}
                    className="group flex gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <button className="shrink-0 pt-0.5 font-mono text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                      {formatTimestamp(seg.startMs)}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 text-xs font-medium text-zinc-500">
                        {speaker?.displayName ?? speaker?.label ?? "Unknown"}
                      </p>
                      <p
                        className={`text-sm leading-relaxed text-zinc-900 dark:text-zinc-100 ${
                          lowConfidence ? "underline decoration-amber-400 decoration-wavy" : ""
                        }`}
                        contentEditable
                        suppressContentEditableWarning
                      >
                        {seg.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-300">
            <Sparkles className="h-4 w-4" />
            AI actions
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Summarize", "Chapters", "Action items", "Quotes", "Generate subtitles"].map(
              (action) => (
                <Button key={action} variant="secondary" size="sm">
                  {action}
                </Button>
              ),
            )}
          </div>
        </div>
      </div>
    </ProjectEditorShell>
  );
}
