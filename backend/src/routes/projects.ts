import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../lib/auth.js";
import {
  mapExport,
  mapProjectSummary,
  mapRepurposeOutput,
  mapSpeaker,
  mapSubtitleSegment,
  mapTranscriptSegment,
} from "../lib/mappers.js";
import type { Env } from "../lib/env.js";
import { createAdminClient } from "../lib/supabase.js";
import { createWorker } from "../jobs/worker.js";
import type { OutputOption } from "../domain/processing.js";
import { CreditsService, InsufficientCreditsError } from "../services/credits.js";
import { UploadService, UploadVerificationError } from "../services/upload.js";
import { MediaProbeService } from "../services/media-probe.js";
import { mapProcessingEvent } from "../services/processing-events.js";
import {
  sourceFileType,
  sourceStoragePath,
} from "../lib/storage-paths.js";

const createProjectSchema = z.object({
  title: z.string().min(1),
  fileName: z.string().min(1),
  mediaType: z.enum(["audio", "video"]).optional(),
  durationMinutes: z.number().int().min(0).default(0),
  language: z.enum(["auto", "english", "hindi", "hinglish"]).default("auto"),
  outputs: z.array(z.string()).default(["transcript"]),
  transcriptMode: z.enum(["clean", "verbatim"]).default("clean"),
});

const confirmUploadSchema = z.object({
  durationMinutes: z.number().int().min(1).optional(),
});

const updateProjectSchema = z.object({
  title: z.string().min(1).optional(),
  language: z.enum(["auto", "english", "hindi", "hinglish"]).optional(),
  transcriptMode: z.enum(["clean", "verbatim"]).optional(),
});

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm"]);

function inferMediaType(fileName: string): "audio" | "video" | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  if (AUDIO_EXTENSIONS.has(ext)) return "audio";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return null;
}

export function projectRoutes(env: Env) {
  const admin = createAdminClient(env);
  const { queue } = createWorker(env, admin);
  const credits = new CreditsService(admin);
  const uploadService = new UploadService(admin);
  const mediaProbe = new MediaProbeService();

  return new Hono<{ Variables: AuthVariables }>()
    .get("/", async (c) => {
      const supabase = c.get("supabase");
      const userId = c.get("userId");
      const status = c.req.query("status");

      let query = supabase
        .from("projects")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status as "processing" | "completed" | "failed" | "partial" | "draft");
      }

      const { data, error } = await query;
      if (error) return c.json({ error: error.message }, 400);

      return c.json({ projects: (data ?? []).map(mapProjectSummary) });
    })
    .post("/", async (c) => {
      const supabase = c.get("supabase");
      const userId = c.get("userId");
      const body = createProjectSchema.parse(await c.req.json());

      const mediaType = body.mediaType ?? inferMediaType(body.fileName);
      if (!mediaType) {
        return c.json({ error: "Unsupported file format" }, 400);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("data_retention_days")
        .eq("id", userId)
        .single();

      if (profileError || !profile) {
        return c.json({ error: "Profile not found" }, 404);
      }

      const mediaExpiresAt = new Date();
      mediaExpiresAt.setDate(mediaExpiresAt.getDate() + profile.data_retention_days);

      const { data: project, error } = await supabase
        .from("projects")
        .insert({
          user_id: userId,
          title: body.title,
          file_name: body.fileName,
          media_type: mediaType,
          duration_minutes: 0,
          language: body.language,
          outputs: body.outputs,
          transcript_mode: body.transcriptMode,
          status: "draft",
          upload_status: "draft",
          processing_state: "queued",
          media_expires_at: mediaExpiresAt.toISOString(),
        })
        .select("*")
        .single();

      if (error || !project) {
        return c.json({ error: error?.message ?? "Failed to create project" }, 400);
      }

      return c.json({ project: mapProjectSummary(project) }, 201);
    })
    .get("/:id", async (c) => {
      const supabase = c.get("supabase");
      const projectId = c.req.param("id");

      const { data: project, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

      if (error || !project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const [speakers, segments, subtitles, repurpose, exports] = await Promise.all([
        supabase.from("speakers").select("*").eq("project_id", projectId).order("speaking_percent", { ascending: false }),
        supabase.from("transcript_segments").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("subtitle_segments").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("repurpose_outputs").select("*").eq("project_id", projectId),
        supabase.from("exports").select("*").eq("project_id", projectId),
      ]);

      return c.json({
        project: {
          ...mapProjectSummary(project),
          segments: (segments.data ?? []).map(mapTranscriptSegment),
          speakers: (speakers.data ?? []).map(mapSpeaker),
          subtitles: (subtitles.data ?? []).map(mapSubtitleSegment),
          repurpose: (repurpose.data ?? []).map(mapRepurposeOutput),
          exports: (exports.data ?? []).map(mapExport),
        },
      });
    })
    .get("/:id/transcript", async (c) => {
      const supabase = c.get("supabase");
      const projectId = c.req.param("id");

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

      if (projectError || !project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const [segments, speakers] = await Promise.all([
        supabase.from("transcript_segments").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("speakers").select("*").eq("project_id", projectId).order("speaking_percent", { ascending: false }),
      ]);

      return c.json({
        segments: (segments.data ?? []).map(mapTranscriptSegment),
        speakers: (speakers.data ?? []).map(mapSpeaker),
      });
    })
    .get("/:id/processing-events", async (c) => {
      const supabase = c.get("supabase");
      const projectId = c.req.param("id");

      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .is("deleted_at", null)
        .single();

      if (projectError || !project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const { data, error } = await supabase
        .from("processing_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });

      if (error) return c.json({ error: error.message }, 400);

      return c.json({ events: (data ?? []).map(mapProcessingEvent) });
    })
    .patch("/:id", async (c) => {
      const supabase = c.get("supabase");
      const projectId = c.req.param("id");
      const body = updateProjectSchema.parse(await c.req.json());

      const { data, error } = await supabase
        .from("projects")
        .update({
          title: body.title,
          language: body.language,
          transcript_mode: body.transcriptMode,
        })
        .eq("id", projectId)
        .select("*")
        .single();

      if (error || !data) {
        return c.json({ error: error?.message ?? "Failed to update project" }, 400);
      }

      return c.json({ project: mapProjectSummary(data) });
    })
    .delete("/:id", async (c) => {
      const supabase = c.get("supabase");
      const projectId = c.req.param("id");

      const { error } = await supabase
        .from("projects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", projectId);

      if (error) return c.json({ error: error.message }, 400);
      return c.json({ success: true });
    })
    .post("/:id/upload-url", async (c) => {
      const userId = c.get("userId");
      const projectId = c.req.param("id");

      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("id, file_name, user_id, media_type")
        .eq("id", projectId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (projectError || !project) {
        return c.json({ error: "Project not found" }, 404);
      }

      const storagePath = sourceStoragePath(userId, projectId, project.file_name);
      const { data, error } = await admin.storage
        .from("uploads")
        .createSignedUploadUrl(storagePath);

      if (error || !data) {
        return c.json({ error: error?.message ?? "Failed to create upload URL" }, 400);
      }

      await admin
        .from("projects")
        .update({
          storage_path: storagePath,
          upload_status: "uploading",
        })
        .eq("id", projectId);

      return c.json({
        uploadUrl: data.signedUrl,
        token: data.token,
        path: storagePath,
      });
    })
    .post("/:id/confirm-upload", async (c) => {
      const userId = c.get("userId");
      const projectId = c.req.param("id");
      const body = confirmUploadSchema.parse(await c.req.json().catch(() => ({})));

      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (projectError || !project) {
        return c.json({ error: "Project not found" }, 404);
      }

      if (!project.storage_path) {
        return c.json({ error: "Upload file before confirming" }, 400);
      }

      if (project.upload_status === "ready_to_process") {
        return c.json({
          message: "Upload already confirmed",
          project: mapProjectSummary(project),
          durationMinutes: project.duration_minutes,
          creditsReserved: project.credits_reserved,
        });
      }

      try {
        const verified = await uploadService.verifyObject(project.storage_path, project.file_name);
        const probe = mediaProbe.probe(verified.sizeBytes, body.durationMinutes);

        await credits.reserve({
          userId,
          projectId,
          amount: probe.durationMinutes,
          projectTitle: project.title,
          outputTypes: project.outputs,
          durationMinutes: probe.durationMinutes,
          idempotencyKey: `reserve:${projectId}`,
        });

        await admin.from("project_files").delete().eq("project_id", projectId).eq("file_type", sourceFileType(project.media_type));

        await admin.from("project_files").insert({
          project_id: projectId,
          file_type: sourceFileType(project.media_type),
          storage_bucket: "uploads",
          storage_path: verified.storagePath,
          mime_type: verified.mimeType,
          size_bytes: verified.sizeBytes,
          duration_seconds: probe.durationSeconds,
        });

        const { data: updated, error: updateError } = await admin
          .from("projects")
          .update({
            upload_status: "ready_to_process",
            duration_minutes: probe.durationMinutes,
            status: "draft",
          })
          .eq("id", projectId)
          .select("*")
          .single();

        if (updateError || !updated) {
          return c.json({ error: updateError?.message ?? "Failed to confirm upload" }, 400);
        }

        return c.json({
          message: "Upload confirmed",
          project: mapProjectSummary(updated),
          durationMinutes: probe.durationMinutes,
          creditsReserved: probe.durationMinutes,
        });
      } catch (error) {
        if (error instanceof UploadVerificationError) {
          return c.json({ error: error.message }, 400);
        }
        if (error instanceof InsufficientCreditsError) {
          return c.json(
            {
              error: "Insufficient credits",
              creditsRemaining: error.creditsRemaining,
              creditsNeeded: error.creditsNeeded,
            },
            402,
          );
        }
        throw error;
      }
    })
    .post("/:id/process", async (c) => {
      const userId = c.get("userId");
      const projectId = c.req.param("id");

      const { data: project, error: projectError } = await admin
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .eq("user_id", userId)
        .is("deleted_at", null)
        .single();

      if (projectError || !project) {
        return c.json({ error: "Project not found" }, 404);
      }

      if (project.upload_status !== "ready_to_process") {
        return c.json({ error: "Confirm upload before starting processing" }, 400);
      }

      if (!project.storage_path) {
        return c.json({ error: "Upload file before starting processing" }, 400);
      }

      if (project.status === "processing" && project.processing_state !== "queued" && project.processing_state !== "failed") {
        return c.json({
          message: "Processing already in progress",
          projectId,
          processingState: project.processing_state,
        });
      }

      await admin
        .from("projects")
        .update({
          processing_state: "queued",
          status: "processing",
        })
        .eq("id", projectId);

      const { jobId } = await queue.enqueuePipeline({
        projectId,
        userId,
        outputs: project.outputs as OutputOption[],
        transcriptMode: project.transcript_mode,
        language: project.language,
        mediaType: project.media_type,
        storagePath: project.storage_path,
      });

      return c.json({
        message: "Processing queued",
        projectId,
        jobId,
      });
    });
}
