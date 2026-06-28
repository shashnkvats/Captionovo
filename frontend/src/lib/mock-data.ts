import type {
  CreditTransaction,
  Project,
  TranscriptSegment,
  UserProfile,
} from "./types";

export const mockUser: UserProfile = {
  name: "Shashank",
  email: "shashank@example.com",
  creditsRemaining: 284,
  planName: "Creator",
  usageThisMonth: 116,
};

const sampleSegments: TranscriptSegment[] = [
  {
    id: "s1",
    startMs: 0,
    endMs: 4200,
    speakerId: "sp1",
    text: "Welcome back to the channel. Today we're talking about building a creator workflow from one upload.",
    confidence: 0.97,
  },
  {
    id: "s2",
    startMs: 4200,
    endMs: 9100,
    speakerId: "sp2",
    text: "The idea is simple — upload once, get transcript, subtitles, and reusable content.",
    confidence: 0.94,
  },
  {
    id: "s3",
    startMs: 9100,
    endMs: 14800,
    speakerId: "sp1",
    text: "Hinglish support matters a lot for Indian creators. Auto-detect should just work.",
    confidence: 0.89,
  },
  {
    id: "s4",
    startMs: 14800,
    endMs: 19200,
    speakerId: "sp2",
    text: "And if video rendering fails, the transcript should still be ready. Partial success is better than full failure.",
    confidence: 0.96,
  },
];

export const mockProjects: Project[] = [
  {
    id: "proj-1",
    title: "Podcast Episode 12 — Creator Workflow",
    fileName: "podcast-ep12.mp4",
    mediaType: "video",
    durationMinutes: 42,
    language: "hinglish",
    status: "completed",
    createdAt: "2026-06-18T10:30:00Z",
    outputs: ["transcript", "speaker_labels", "subtitles", "summary", "burned_video"],
    creditsUsed: 42,
    transcriptMode: "clean",
    segments: sampleSegments,
    speakers: [
      { id: "sp1", label: "Person_1", displayName: "Host", speakingPercent: 58 },
      { id: "sp2", label: "Person_2", displayName: "Guest", speakingPercent: 42 },
    ],
    subtitles: [
      { id: "sub1", startMs: 0, endMs: 4200, text: "Welcome back to the channel." },
      { id: "sub2", startMs: 4200, endMs: 9100, text: "Upload once, get transcript and subtitles." },
    ],
    repurpose: [
      {
        id: "r1",
        type: "summary",
        title: "Summary",
        content:
          "This episode covers a creator-first workflow: upload audio/video once, receive transcript, speaker labels, subtitles, burned MP4, and repurposed content. Key emphasis on Hinglish support and partial success handling.",
        status: "ready",
      },
      {
        id: "r2",
        type: "chapters",
        title: "Chapters",
        content:
          "0:00 — Intro\n0:42 — Upload once workflow\n1:31 — Hinglish & auto-detect\n2:28 — Partial success UX",
        status: "ready",
      },
    ],
    exports: [
      { format: "txt", label: "TXT", status: "ready", fileSize: "24 KB" },
      { format: "docx", label: "DOCX", status: "ready", fileSize: "48 KB" },
      { format: "srt", label: "SRT", status: "ready", fileSize: "12 KB" },
      { format: "mp4", label: "Subtitled MP4", status: "ready", fileSize: "186 MB" },
      { format: "pdf", label: "PDF", status: "not_generated" },
    ],
  },
  {
    id: "proj-2",
    title: "Client Interview — Legal Deposition",
    fileName: "deposition-audio.wav",
    mediaType: "audio",
    durationMinutes: 67,
    language: "english",
    status: "processing",
    processingState: "transcribing",
    createdAt: "2026-06-20T14:00:00Z",
    outputs: ["transcript", "speaker_labels"],
    creditsUsed: 0,
    transcriptMode: "verbatim",
  },
  {
    id: "proj-3",
    title: "Team Standup Recording",
    fileName: "standup-june.m4a",
    mediaType: "audio",
    durationMinutes: 18,
    language: "english",
    status: "partial",
    createdAt: "2026-06-19T09:15:00Z",
    outputs: ["transcript", "summary", "burned_video"],
    creditsUsed: 18,
    transcriptMode: "clean",
    segments: sampleSegments.slice(0, 2),
  },
  {
    id: "proj-4",
    title: "YouTube Short — Product Demo",
    fileName: "demo-short.mov",
    mediaType: "video",
    durationMinutes: 3,
    language: "english",
    status: "failed",
    createdAt: "2026-06-17T16:45:00Z",
    outputs: ["transcript", "subtitles"],
    creditsUsed: 0,
    transcriptMode: "clean",
  },
];

export const mockTransactions: CreditTransaction[] = [
  {
    id: "tx1",
    projectTitle: "Podcast Episode 12 — Creator Workflow",
    durationMinutes: 42,
    creditsUsed: 42,
    outputTypes: ["Transcript", "Subtitles", "Burned MP4"],
    date: "2026-06-18T10:30:00Z",
  },
  {
    id: "tx2",
    projectTitle: "Team Standup Recording",
    durationMinutes: 18,
    creditsUsed: 18,
    outputTypes: ["Transcript", "Summary"],
    date: "2026-06-19T09:15:00Z",
  },
];

export function getProject(id: string): Project | undefined {
  return mockProjects.find((p) => p.id === id);
}
