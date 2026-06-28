import Link from "next/link";
import { formatDate, formatDuration } from "@/lib/utils";
import type { Project } from "@/lib/types";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { FileAudio, FileVideo, Download } from "lucide-react";

const languageLabels: Record<Project["language"], string> = {
  auto: "Auto",
  english: "English",
  hindi: "Hindi",
  hinglish: "Hinglish",
};

export function ProjectCard({ project }: { project: Project }) {
  const href =
    project.status === "processing"
      ? `/projects/${project.id}/processing`
      : `/projects/${project.id}`;

  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                {project.mediaType === "video" ? (
                  <FileVideo className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                ) : (
                  <FileAudio className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-100">
                  {project.title}
                </h3>
                <p className="truncate text-sm text-zinc-500">{project.fileName}</p>
              </div>
            </div>
            <StatusBadge status={project.status} />
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
            <span>{formatDuration(project.durationMinutes)}</span>
            <span>·</span>
            <span>{languageLabels[project.language]}</span>
            <span>·</span>
            <span>{formatDate(project.createdAt)}</span>
          </div>

          {project.status === "completed" && (
            <div className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400">
              <Download className="h-3.5 w-3.5" />
              Last export ready
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
