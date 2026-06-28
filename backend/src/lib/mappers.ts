import type { Tables } from "../types/database.js";

type DbProject = Tables<"projects">;
type DbSpeaker = Tables<"speakers">;
type DbTranscriptSegment = Tables<"transcript_segments">;
type DbSubtitleSegment = Tables<"subtitle_segments">;
type DbRepurposeOutput = Tables<"repurpose_outputs">;
type DbExport = Tables<"exports">;
type DbProfile = Tables<"profiles">;
type DbCreditTransaction = Tables<"credit_transactions">;

export function mapProfile(row: DbProfile) {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    planName: row.plan_name,
    creditsRemaining: row.credits_remaining,
    defaultLanguage: row.default_language,
    defaultTranscriptMode: row.default_transcript_mode,
    defaultSubtitleStyle: row.default_subtitle_style,
    dataRetentionDays: row.data_retention_days,
    notificationEmail: row.notification_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapProjectSummary(row: DbProject) {
  return {
    id: row.id,
    title: row.title,
    fileName: row.file_name,
    mediaType: row.media_type,
    durationMinutes: row.duration_minutes,
    language: row.language,
    status: row.status,
    uploadStatus: row.upload_status,
    processingState: row.processing_state,
    outputs: row.outputs,
    creditsUsed: row.credits_used,
    transcriptMode: row.transcript_mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapSpeaker(row: DbSpeaker) {
  return {
    id: row.id,
    label: row.speaker_key,
    displayName: row.display_name ?? undefined,
    speakingPercent: Number(row.speaking_percent),
  };
}

export function mapTranscriptSegment(row: DbTranscriptSegment) {
  return {
    id: row.id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    speakerId: row.speaker_id ?? "",
    text: row.text,
    confidence: row.confidence != null ? Number(row.confidence) : undefined,
  };
}

export function mapSubtitleSegment(row: DbSubtitleSegment) {
  return {
    id: row.id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    text: row.text,
  };
}

export function mapRepurposeOutput(row: DbRepurposeOutput) {
  return {
    id: row.id,
    type: row.output_type,
    title: row.title,
    content: row.content,
    status: row.status,
  };
}

const exportLabels: Record<string, string> = {
  txt: "TXT",
  docx: "DOCX",
  pdf: "PDF",
  srt: "SRT",
  vtt: "VTT",
  json: "JSON",
  mp4: "Subtitled MP4",
  summary_docx: "Summary DOCX",
  summary_pdf: "Summary PDF",
};

export function mapExport(row: DbExport) {
  return {
    format: row.format,
    label: exportLabels[row.format] ?? row.format.toUpperCase(),
    status: row.status,
    fileSize: row.file_size_bytes
      ? formatBytes(row.file_size_bytes)
      : undefined,
  };
}

export function mapCreditTransaction(row: DbCreditTransaction) {
  return {
    id: row.id,
    projectTitle: row.project_title,
    durationMinutes: row.duration_minutes,
    creditsUsed: row.credits_used,
    outputTypes: row.output_types,
    date: row.created_at,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function usageThisMonth(
  transactions: Pick<DbCreditTransaction, "credits_used" | "created_at">[],
): number {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  return transactions
    .filter((tx) => new Date(tx.created_at) >= startOfMonth)
    .reduce((sum, tx) => sum + tx.credits_used, 0);
}
