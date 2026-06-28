import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../lib/auth.js";
import type { ExportFormat } from "../domain/processing.js";
import { mapExport } from "../lib/mappers.js";

const exportRequestSchema = z.object({
  format: z.enum([
    "txt",
    "docx",
    "pdf",
    "srt",
    "vtt",
    "json",
    "mp4",
    "summary_docx",
    "summary_pdf",
  ]),
});

export const exportRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/:projectId/exports", async (c) => {
    const supabase = c.get("supabase");
    const projectId = c.req.param("projectId");

    const { data, error } = await supabase
      .from("exports")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at");

    if (error) return c.json({ error: error.message }, 400);
    return c.json({ exports: (data ?? []).map(mapExport) });
  })
  .post("/:projectId/exports", async (c) => {
    const supabase = c.get("supabase");
    const projectId = c.req.param("projectId");
    const body = exportRequestSchema.parse(await c.req.json());

    const { data: existing } = await supabase
      .from("exports")
      .select("*")
      .eq("project_id", projectId)
      .eq("format", body.format)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("exports")
        .update({ status: "generating" })
        .eq("id", existing.id);
    } else {
      await supabase.from("exports").insert({
        project_id: projectId,
        format: body.format as ExportFormat,
        status: "generating",
      });
    }

    // Export generation jobs will plug into processing_jobs with job_type = export.
    return c.json({
      message: "Export queued",
      projectId,
      format: body.format,
      note: "Export worker not yet connected",
    });
  });
