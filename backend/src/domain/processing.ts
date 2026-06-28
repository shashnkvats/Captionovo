import type { Tables } from "../types/database.js";

export type DbProject = Tables<"projects">;
export type ProcessingState = DbProject["processing_state"];
export type ProjectStatus = DbProject["status"];

export type JobType = "project_pipeline" | "export" | "repurpose" | "burn_subtitles";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type OutputOption =
  | "transcript"
  | "speaker_labels"
  | "subtitles"
  | "summary"
  | "burned_video"
  | "repurpose";

export type ExportFormat =
  | "txt"
  | "docx"
  | "pdf"
  | "srt"
  | "vtt"
  | "json"
  | "mp4"
  | "summary_docx"
  | "summary_pdf";

export interface PipelineJobPayload {
  projectId: string;
  userId: string;
  outputs: OutputOption[];
  transcriptMode: "clean" | "verbatim";
  language: DbProject["language"];
  mediaType: DbProject["media_type"];
  storagePath: string;
}

export interface ExportJobPayload {
  projectId: string;
  userId: string;
  format: ExportFormat;
}

export interface TranscriptWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence?: number;
}

export interface TranscriptSegmentDraft {
  startMs: number;
  endMs: number;
  text: string;
  speakerKey?: string;
  confidence?: number;
  words?: TranscriptWord[];
}

export interface SpeakerDraft {
  speakerKey: string;
  displayName?: string;
  speakingPercent: number;
}

export interface TranscriptionResult {
  detectedLanguage?: DbProject["language"];
  segments: TranscriptSegmentDraft[];
  speakers: SpeakerDraft[];
  durationMs: number;
}

export type PipelineStageName =
  | "extracting_audio"
  | "detecting_language"
  | "transcribing"
  | "persisting_transcript"
  | "transcript_ready"
  | "diarizing_speakers"
  | "generating_subtitles"
  | "generating_summary"
  | "rendering_video"
  | "preparing_editor";
