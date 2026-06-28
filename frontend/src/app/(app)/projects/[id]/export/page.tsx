import { ProjectEditorShell } from "@/components/editor/project-editor-shell";
import { ExportBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchProject } from "@/lib/api/server";
import { Download, RefreshCw, Trash2 } from "lucide-react";

export default async function ExportTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);

  const exports = project.exports ?? [];

  return (
    <ProjectEditorShell project={project}>
      <div className="grid gap-4 sm:grid-cols-2">
        {exports.length === 0 ? (
          <p className="col-span-2 text-sm text-zinc-500">No exports available yet</p>
        ) : (
          exports.map((item) => (
            <Card key={item.format}>
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">
                      {item.label}
                    </h3>
                    {item.fileSize && (
                      <p className="text-xs text-zinc-500">{item.fileSize}</p>
                    )}
                  </div>
                  <ExportBadge status={item.status} />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={item.status !== "ready"}
                    className="flex-1"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  <Button variant="secondary" size="sm">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </ProjectEditorShell>
  );
}
