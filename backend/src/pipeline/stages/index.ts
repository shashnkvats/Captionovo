import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PipelineContext, PipelineStage } from "../context.js";
import { emitStageEvent, updateProjectStep } from "../context.js";
import { ensureExportRow } from "../../lib/exports.js";
import { saveTranscription } from "../../lib/persist-transcript.js";

async function downloadMedia(ctx: PipelineContext) {
  if (ctx.localMediaPath) return ctx.localMediaPath;

  const { data, error } = await ctx.admin.storage
    .from("uploads")
    .download(ctx.payload.storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to download source media");
  }

  const localPath = join(ctx.workDir, "source.bin");
  await writeFile(localPath, Buffer.from(await data.arrayBuffer()));
  ctx.localMediaPath = localPath;
  return localPath;
}

export const extractAudioStage: PipelineStage = {
  name: "extracting_audio",
  critical: true,
  shouldRun: () => true,
  async run(ctx) {
    await emitStageEvent(ctx, "extracting_audio", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "extracting_audio");
    const mediaPath = await downloadMedia(ctx);
    const audioPath = join(ctx.workDir, "audio.wav");
    const result = await ctx.providers.media.extractAudio({
      inputPath: mediaPath,
      outputPath: audioPath,
    });
    ctx.localAudioPath = result.audioPath;
    await emitStageEvent(ctx, "extracting_audio", "completed");
  },
};

export const detectLanguageStage: PipelineStage = {
  name: "detecting_language",
  critical: true,
  shouldRun: () => true,
  async run(ctx) {
    await emitStageEvent(ctx, "detecting_language", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "detecting_language");
    await emitStageEvent(ctx, "detecting_language", "completed");
  },
};

export const transcribeStage: PipelineStage = {
  name: "transcribing",
  critical: true,
  shouldRun: () => true,
  async run(ctx) {
    await emitStageEvent(ctx, "transcribing", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "transcribing");
    const mediaPath = ctx.localAudioPath ?? ctx.localMediaPath;
    if (!mediaPath) throw new Error("Media not prepared for transcription");

    ctx.transcription = await ctx.providers.transcription.transcribe({
      language: ctx.payload.language,
      transcriptMode: ctx.payload.transcriptMode,
      mediaPath,
    });

    if (ctx.transcription.detectedLanguage && ctx.payload.language === "auto") {
      await ctx.admin
        .from("projects")
        .update({ language: ctx.transcription.detectedLanguage })
        .eq("id", ctx.payload.projectId);
    }
    await emitStageEvent(ctx, "transcribing", "completed");
  },
};

export const persistTranscriptStage: PipelineStage = {
  name: "persisting_transcript",
  critical: true,
  shouldRun: () => true,
  async run(ctx) {
    await emitStageEvent(ctx, "persisting_transcript", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "persisting_transcript");
    if (!ctx.transcription) throw new Error("Transcription missing before persist");

    await saveTranscription(ctx.admin, ctx.payload.projectId, ctx.transcription);
    ctx.hasTranscript = true;

    await ctx.admin
      .from("projects")
      .update({ processing_state: "transcript_ready" })
      .eq("id", ctx.payload.projectId);

    await emitStageEvent(ctx, "persisting_transcript", "completed");
  },
};

export const diarizeStage: PipelineStage = {
  name: "diarizing_speakers",
  critical: false,
  shouldRun: (ctx) => ctx.payload.outputs.includes("speaker_labels"),
  async run(ctx) {
    await emitStageEvent(ctx, "diarizing_speakers", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "diarizing_speakers");
    const mediaPath = ctx.localAudioPath ?? ctx.localMediaPath;
    if (!mediaPath || !ctx.transcription) {
      throw new Error("Transcription required before diarization");
    }

    ctx.transcription = await ctx.providers.diarization.assignSpeakers({
      mediaPath,
      segments: ctx.transcription.segments,
    });

    await saveTranscription(ctx.admin, ctx.payload.projectId, ctx.transcription);
    await emitStageEvent(ctx, "diarizing_speakers", "completed");
  },
};

export const generateSubtitlesStage: PipelineStage = {
  name: "generating_subtitles",
  critical: false,
  shouldRun: (ctx) =>
    ctx.payload.outputs.includes("subtitles") || ctx.payload.outputs.includes("burned_video"),
  async run(ctx) {
    await emitStageEvent(ctx, "generating_subtitles", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "generating_subtitles");
    if (!ctx.transcription) throw new Error("Transcription required before subtitles");

    await ctx.admin.from("subtitle_segments").delete().eq("project_id", ctx.payload.projectId);

    const subtitleRows = ctx.transcription.segments.map((segment, index) => ({
      project_id: ctx.payload.projectId,
      sort_order: index,
      start_ms: segment.startMs,
      end_ms: segment.endMs,
      text: segment.text,
    }));

    if (subtitleRows.length > 0) {
      const { error } = await ctx.admin.from("subtitle_segments").insert(subtitleRows);
      if (error) throw new Error(error.message);
    }

    for (const format of ["srt", "vtt"] as const) {
      await ensureExportRow(ctx.admin, ctx.payload.projectId, format);
    }
    await emitStageEvent(ctx, "generating_subtitles", "completed");
  },
};

export const generateSummaryStage: PipelineStage = {
  name: "generating_summary",
  critical: false,
  shouldRun: (ctx) =>
    ctx.payload.outputs.includes("summary") || ctx.payload.outputs.includes("repurpose"),
  async run(ctx) {
    await emitStageEvent(ctx, "generating_summary", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "generating_summary");
    await emitStageEvent(ctx, "generating_summary", "completed");
  },
};

export const renderVideoStage: PipelineStage = {
  name: "rendering_video",
  critical: false,
  shouldRun: (ctx) => ctx.payload.outputs.includes("burned_video"),
  async run(ctx) {
    await emitStageEvent(ctx, "rendering_video", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "rendering_video");
    const mediaPath = ctx.localMediaPath;
    if (!mediaPath) throw new Error("Source video required for subtitle burn-in");

    const subtitlePath = join(ctx.workDir, "subtitles.srt");
    const outputPath = join(ctx.workDir, "burned.mp4");
    await writeFile(subtitlePath, "WEBVTT\n");

    await ctx.providers.media.burnSubtitles({
      inputVideoPath: mediaPath,
      subtitlePath,
      outputPath,
    });

    const storagePath = `${ctx.payload.userId}/${ctx.payload.projectId}/burned.mp4`;
    await ensureExportRow(ctx.admin, ctx.payload.projectId, "mp4", {
      status: "not_generated",
      storage_path: storagePath,
    });
    await emitStageEvent(ctx, "rendering_video", "completed");
  },
};

export const prepareEditorStage: PipelineStage = {
  name: "preparing_editor",
  critical: false,
  shouldRun: () => true,
  async run(ctx) {
    await emitStageEvent(ctx, "preparing_editor", "started");
    await updateProjectStep(ctx.admin, ctx.payload.projectId, "preparing_editor");

    for (const format of ["txt", "docx", "pdf"] as const) {
      await ensureExportRow(ctx.admin, ctx.payload.projectId, format);
    }
    await emitStageEvent(ctx, "preparing_editor", "completed");
  },
};

export const pipelineStages: PipelineStage[] = [
  extractAudioStage,
  detectLanguageStage,
  transcribeStage,
  persistTranscriptStage,
  diarizeStage,
  generateSubtitlesStage,
  generateSummaryStage,
  renderVideoStage,
  prepareEditorStage,
];
