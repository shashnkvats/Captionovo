import type { AppSupabaseClient } from "../lib/supabase.js";

export async function ensureExportRow(
  admin: AppSupabaseClient,
  projectId: string,
  format: string,
  extra: { status?: string; storage_path?: string } = {},
) {
  const { data: existing } = await admin
    .from("exports")
    .select("id")
    .eq("project_id", projectId)
    .eq("format", format)
    .maybeSingle();

  if (existing) return;

  await admin.from("exports").insert({
    project_id: projectId,
    format,
    status: extra.status ?? "not_generated",
    storage_path: extra.storage_path ?? null,
  });
}
