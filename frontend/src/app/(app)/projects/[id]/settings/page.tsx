import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/input";
import { fetchProject } from "@/lib/api/server";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to editor
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Project Settings
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{project.title}</p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <div>
            <Label htmlFor="name">Project name</Label>
            <input
              id="name"
              defaultValue={project.title}
              className="mt-1.5 h-10 w-full rounded-lg border border-zinc-200 px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>

          <div>
            <Label>Language mode</Label>
            <p className="mt-1 text-sm capitalize text-zinc-600 dark:text-zinc-400">
              {project.language}
            </p>
          </div>

          <div className="space-y-3">
            <Label>Source file retention</Label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="retention" defaultChecked />
              Keep original media (30 days)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="retention" />
              Delete original media after processing
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="retention" />
              Keep transcript only
            </label>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <Button variant="secondary" size="sm">
              Regenerate transcript
            </Button>
            <Button variant="secondary" size="sm">
              Regenerate speakers
            </Button>
            <Button variant="secondary" size="sm">
              Regenerate subtitles
            </Button>
          </div>

          <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
            <Button variant="danger" size="sm">
              Delete project permanently
            </Button>
            <p className="mt-2 text-xs text-zinc-500">
              Deleting media affects future regeneration and export options.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
