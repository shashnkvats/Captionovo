import Link from "next/link";
import { Search, Upload } from "lucide-react";
import { ProjectCard } from "@/components/dashboard/project-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchProfile, fetchProjects } from "@/lib/api/server";

export default async function DashboardPage() {
  const [{ profile, usageThisMonth }, projects] = await Promise.all([
    fetchProfile(),
    fetchProjects(),
  ]);

  const processing = projects.filter((p) => p.status === "processing");
  const completed = projects.filter((p) => p.status !== "processing");

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {profile.creditsRemaining} minutes remaining · {usageThisMonth} used this month
          </p>
        </div>
        <Link href="/upload">
          <Button>
            <Upload className="h-4 w-4" />
            New Upload
          </Button>
        </Link>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <Input className="pl-9" placeholder="Search projects..." />
      </div>

      {projects.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-200 p-12 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500">No projects yet. Upload your first file to get started.</p>
          <Link href="/upload" className="mt-4 inline-block">
            <Button size="sm">New Upload</Button>
          </Link>
        </div>
      )}

      {processing.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Processing
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {processing.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Recent projects
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {completed.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
