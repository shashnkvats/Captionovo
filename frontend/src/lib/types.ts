export type Language = "auto" | "english" | "hindi" | "hinglish";

export type OutputOption =
  | "transcript"
  | "speaker_labels"
  | "subtitles"
  | "summary"
  | "burned_video"
  | "repurpose";

export type UploadState =
  | "not_started"
  | "uploading"
  | "upload_paused"
  | "upload_failed"
  | "upload_complete";

export type ProcessingState =
  | "queued"
  | "extracting_audio"
  | "detecting_language"
  | "transcribing"
  | "persisting_transcript"
  | "transcript_ready"
  | "diarizing_speakers"
  | "generating_subtitles"
  | "generating_summary"
  | "rendering_video"
  | "preparing_editor"
  | "completed"
  | "partially_completed"
  | "failed";

export type ProjectStatus = "draft" | "processing" | "completed" | "failed" | "partial";

export type ExportState =
  | "not_generated"
  | "generating"
  | "ready"
  | "failed"
  | "expired";

export type TranscriptMode = "clean" | "verbatim";

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

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  speakerId: string;
  text: string;
  confidence?: number;
}

export interface Speaker {
  id: string;
  label: string;
  displayName?: string;
  speakingPercent: number;
}

export interface SubtitleSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

export interface RepurposeOutput {
  id: string;
  type:
    | "summary"
    | "chapters"
    | "key_points"
    | "youtube_description"
    | "linkedin_post"
    | "blog_draft"
    | "shorts_ideas"
    | "quotes";
  title: string;
  content: string;
  status: "ready" | "generating" | "failed";
}

export interface ExportItem {
  format: ExportFormat;
  label: string;
  status: ExportState;
  fileSize?: string;
}

export interface Project {
  id: string;
  title: string;
  fileName: string;
  mediaType: "audio" | "video";
  durationMinutes: number;
  language: Language;
  status: ProjectStatus;
  processingState?: ProcessingState;
  createdAt: string;
  outputs: OutputOption[];
  creditsUsed: number;
  transcriptMode: TranscriptMode;
  segments?: TranscriptSegment[];
  speakers?: Speaker[];
  subtitles?: SubtitleSegment[];
  repurpose?: RepurposeOutput[];
  exports?: ExportItem[];
}

export interface CreditTransaction {
  id: string;
  projectTitle: string;
  durationMinutes: number;
  creditsUsed: number;
  outputTypes: string[];
  date: string;
}

export interface UserProfile {
  name: string;
  email: string;
  creditsRemaining: number;
  planName: string;
  usageThisMonth: number;
}
