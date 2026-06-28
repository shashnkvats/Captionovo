"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Settings, Download } from "lucide-react";

const tabs = [
  { href: "", label: "Transcript" },
  { href: "/subtitles", label: "Subtitles" },
  { href: "/repurpose", label: "Repurpose" },
  { href: "/export", label: "Export" },
] as const;

export function ProjectEditorShell({
  project,
  children,
}: {
  project: Project;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const base = `/projects/${project.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
              {project.title}
            </h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {project.fileName} · Saved automatically
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`${base}/settings`}>
            <Button variant="secondary" size="sm">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Link href={`${base}/export`}>
            <Button size="sm">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-900 dark:border-zinc-800">
        <div className="flex aspect-video items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <span className="text-2xl">▶</span>
            </div>
            <p className="text-sm text-zinc-400">Media player · persistent across tabs</p>
          </div>
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="-mb-px flex gap-6 overflow-x-auto">
          {tabs.map(({ href, label }) => {
            const tabHref = `${base}${href}`;
            const active = pathname === tabHref;
            return (
              <Link
                key={label}
                href={tabHref}
                className={cn(
                  "whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors",
                  active
                    ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>{children}</div>
        <aside>
          <SpeakerPanel project={project} />
        </aside>
      </div>
    </div>
  );
}

function SpeakerPanel({ project }: { project: Project }) {
  const speakers = project.speakers ?? [];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Speakers</h3>
      <p className="mt-1 text-xs text-zinc-500">Optional — rename or merge as needed</p>
      {speakers.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">No speakers detected yet</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {speakers.map((speaker) => (
            <li key={speaker.id} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {speaker.displayName ?? speaker.label}
                </span>
                <span className="text-xs text-zinc-500">{speaker.speakingPercent}%</span>
              </div>
              <button className="mt-2 text-xs text-indigo-600 hover:underline dark:text-indigo-400">
                Rename · Play sample
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
