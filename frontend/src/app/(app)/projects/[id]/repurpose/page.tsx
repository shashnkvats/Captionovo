import { ProjectEditorShell } from "@/components/editor/project-editor-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { fetchProject } from "@/lib/api/server";
import { Copy, RefreshCw } from "lucide-react";

const onDemandTypes = [
  "YouTube description",
  "LinkedIn post",
  "Blog draft",
  "Shorts/Reels ideas",
];

export default async function RepurposeTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);

  const outputs = project.repurpose ?? [];

  return (
    <ProjectEditorShell project={project}>
      <div className="space-y-6">
        {outputs.map((output) => (
          <div
            key={output.id}
            className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {output.title}
              </h3>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="p-4">
              <Textarea defaultValue={output.content} className="min-h-32 font-normal" />
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-dashed border-zinc-200 p-6 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Generate on demand
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            Heavier outputs use additional credits
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {onDemandTypes.map((type) => (
              <Button key={type} variant="secondary" size="sm">
                {type}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </ProjectEditorShell>
  );
}
