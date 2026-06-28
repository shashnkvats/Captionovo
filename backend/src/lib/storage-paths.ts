import { extname } from "node:path";

export function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? "upload";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function sourceStoragePath(userId: string, projectId: string, fileName: string): string {
  const safe = sanitizeFileName(fileName);
  return `${userId}/${projectId}/source/${safe}`;
}

export function sourceFileType(mediaType: "audio" | "video"): "source_audio" | "source_video" {
  return mediaType === "audio" ? "source_audio" : "source_video";
}

export function inferMimeType(fileName: string): string | null {
  const ext = extname(fileName).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
  };
  return map[ext] ?? null;
}

export const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;
