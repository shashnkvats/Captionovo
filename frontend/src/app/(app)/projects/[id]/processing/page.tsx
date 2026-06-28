import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { fetchProject } from "@/lib/api/server";
import { ProcessingStatus } from "@/components/projects/processing-status";

export default async function ProcessingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await fetchProject(id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to dashboard
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Processing
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{project.title}</p>
      </div>

      <Card>
        <CardContent className="space-y-6 pt-6">
          <ProcessingStatus
            projectId={id}
            initialProject={{
              id: project.id,
              title: project.title,
              fileName: project.fileName,
              mediaType: project.mediaType,
              durationMinutes: project.durationMinutes,
              language: project.language,
              status: project.status,
              processingState: project.processingState,
              outputs: project.outputs,
              creditsUsed: project.creditsUsed,
              transcriptMode: project.transcriptMode,
              createdAt: project.createdAt,
              updatedAt: project.createdAt,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
