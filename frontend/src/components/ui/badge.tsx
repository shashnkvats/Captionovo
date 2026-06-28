import { cn } from "@/lib/utils";
import type { ProjectStatus, ExportState } from "@/lib/types";

const statusStyles: Record<ProjectStatus, string> = {
  draft: "bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
  processing: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
  failed: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300",
  partial: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-950 dark:text-orange-300",
};

const exportStyles: Record<ExportState, string> = {
  ready: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  generating: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  expired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  not_generated: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export function StatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusStyles[status],
        className,
      )}
    >
      {status === "partial" ? "Partial" : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function ExportBadge({
  status,
  className,
}: {
  status: ExportState;
  className?: string;
}) {
  const labels: Record<ExportState, string> = {
    ready: "Ready",
    generating: "Generating",
    failed: "Failed",
    expired: "Expired",
    not_generated: "Not generated",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        exportStyles[status],
        className,
      )}
    >
      {labels[status]}
    </span>
  );
}
