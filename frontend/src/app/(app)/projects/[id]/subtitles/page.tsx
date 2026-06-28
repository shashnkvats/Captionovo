import { ProjectEditorShell } from "@/components/editor/project-editor-shell";
import { Button } from "@/components/ui/button";
import { fetchProject } from "@/lib/api/server";
import { formatTimestamp } from "@/lib/utils";

export default async function SubtitlesTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);

  const subtitles = project.subtitles ?? [];

  return (
    <ProjectEditorShell project={project}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Font size</span>
            <select className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950">
              <option>Medium</option>
              <option>Small</option>
              <option>Large</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Position</span>
            <select className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950">
              <option>Bottom</option>
              <option>Top</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-500">Max words/line</span>
            <input
              type="number"
              defaultValue={8}
              className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <Button variant="secondary" size="sm" className="self-end">
            Preview subtitles
          </Button>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {subtitles.length === 0 ? (
            <p className="p-8 text-center text-sm text-zinc-500">No subtitles generated</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {subtitles.map((sub) => (
                <li key={sub.id} className="flex gap-4 px-4 py-3">
                  <div className="shrink-0 space-y-1 font-mono text-xs text-zinc-500">
                    <div>{formatTimestamp(sub.startMs)}</div>
                    <div>{formatTimestamp(sub.endMs)}</div>
                  </div>
                  <textarea
                    defaultValue={sub.text}
                    className="min-h-[48px] flex-1 resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm focus:border-indigo-300 focus:bg-zinc-50 focus:outline-none dark:focus:bg-zinc-800"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm">
            Export SRT
          </Button>
          <Button variant="secondary" size="sm">
            Export VTT
          </Button>
          <Button size="sm">Burn into MP4</Button>
        </div>
      </div>
    </ProjectEditorShell>
  );
}
