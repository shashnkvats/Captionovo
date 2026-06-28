import type { ProcessingState } from "./types";

export const PROCESSING_STEPS: { key: ProcessingState; label: string }[] = [
  { key: "queued", label: "Queued" },
  { key: "extracting_audio", label: "Extracting audio" },
  { key: "detecting_language", label: "Detecting language" },
  { key: "transcribing", label: "Transcribing audio" },
  { key: "persisting_transcript", label: "Saving transcript" },
  { key: "transcript_ready", label: "Transcript ready" },
  { key: "diarizing_speakers", label: "Identifying speakers" },
  { key: "generating_subtitles", label: "Generating subtitles" },
  { key: "generating_summary", label: "Generating summary" },
  { key: "rendering_video", label: "Rendering subtitled video" },
  { key: "preparing_editor", label: "Preparing editor" },
  { key: "completed", label: "Completed" },
];

export const SUPPORTED_AUDIO = ["MP3", "WAV", "M4A"];
export const SUPPORTED_VIDEO = ["MP4", "MOV", "WebM"];

export const OUTPUT_OPTIONS = [
  { id: "transcript", label: "Transcript", description: "Full text with timestamps" },
  { id: "speaker_labels", label: "Speaker labels", description: "Who said what" },
  { id: "subtitles", label: "Subtitles", description: "Timed caption segments" },
  { id: "summary", label: "Summary", description: "Quick overview" },
  { id: "burned_video", label: "Burn subtitles into video", description: "MP4 with captions" },
  { id: "repurpose", label: "Repurpose content", description: "Social posts, chapters, more" },
] as const;

export const LANGUAGE_OPTIONS = [
  { id: "auto", label: "Auto-detect" },
  { id: "english", label: "English" },
  { id: "hindi", label: "Hindi" },
  { id: "hinglish", label: "Hinglish" },
] as const;
