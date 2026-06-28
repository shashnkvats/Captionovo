import type {
  CreditTransaction,
  ExportItem,
  Language,
  OutputOption,
  ProcessingState,
  Project,
  ProjectStatus,
  RepurposeOutput,
  TranscriptMode,
  UserProfile,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown,
  ) {
    super(message);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: string }).error)
        : res.statusText;
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export async function apiFetch<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  return parseResponse<T>(res);
}

export interface ProfileResponse {
  profile: {
    id: string;
    name: string;
    email: string;
    planName: string;
    creditsRemaining: number;
    defaultLanguage: Language;
    defaultTranscriptMode: TranscriptMode;
    dataRetentionDays: number;
    notificationEmail: boolean;
  };
  usageThisMonth: number;
}

export interface ApiProjectSummary {
  id: string;
  title: string;
  fileName: string;
  mediaType: "audio" | "video";
  durationMinutes: number;
  language: Language;
  status: ProjectStatus;
  processingState?: ProcessingState;
  outputs: OutputOption[] | string[];
  creditsUsed: number;
  transcriptMode: TranscriptMode;
  createdAt: string;
  updatedAt: string;
}

export interface ApiProjectDetail extends ApiProjectSummary {
  segments: Array<{
    id: string;
    startMs: number;
    endMs: number;
    speakerId: string;
    text: string;
    confidence?: number;
  }>;
  speakers: Array<{
    id: string;
    label: string;
    displayName?: string;
    speakingPercent: number;
  }>;
  subtitles: Array<{
    id: string;
    startMs: number;
    endMs: number;
    text: string;
  }>;
  repurpose: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    status: "ready" | "generating" | "failed";
  }>;
  exports: ExportItem[];
}

export function toUserProfile(data: ProfileResponse): UserProfile & { id: string } {
  return {
    id: data.profile.id,
    name: data.profile.name,
    email: data.profile.email,
    planName: data.profile.planName,
    creditsRemaining: data.profile.creditsRemaining,
    usageThisMonth: data.usageThisMonth,
  };
}

export function toProject(summary: ApiProjectSummary): Project {
  return {
    id: summary.id,
    title: summary.title,
    fileName: summary.fileName,
    mediaType: summary.mediaType,
    durationMinutes: summary.durationMinutes,
    language: summary.language,
    status: summary.status,
    processingState: summary.processingState,
    outputs: summary.outputs as OutputOption[],
    creditsUsed: summary.creditsUsed,
    transcriptMode: summary.transcriptMode,
    createdAt: summary.createdAt,
  };
}

export function toProjectDetail(detail: ApiProjectDetail): Project {
  return {
    ...toProject(detail),
    segments: detail.segments,
    speakers: detail.speakers,
    subtitles: detail.subtitles,
    repurpose: detail.repurpose as RepurposeOutput[],
    exports: detail.exports,
  };
}

export function toCreditTransaction(tx: {
  id: string;
  projectTitle: string;
  durationMinutes: number;
  creditsUsed: number;
  outputTypes: string[];
  date: string;
}): CreditTransaction {
  return {
    id: tx.id,
    projectTitle: tx.projectTitle,
    durationMinutes: tx.durationMinutes,
    creditsUsed: tx.creditsUsed,
    outputTypes: tx.outputTypes,
    date: tx.date,
  };
}
