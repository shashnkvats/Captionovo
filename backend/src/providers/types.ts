import type { DbProject } from "../domain/processing.js";
import type { TranscriptionResult } from "../domain/processing.js";

export interface TranscriptionOptions {
  language: DbProject["language"];
  transcriptMode: DbProject["transcript_mode"];
  mediaPath: string;
}

export interface TranscriptionProvider {
  readonly name: string;
  transcribe(options: TranscriptionOptions): Promise<TranscriptionResult>;
}

export interface DiarizationOptions {
  mediaPath: string;
  segments: TranscriptionResult["segments"];
}

export interface DiarizationProvider {
  readonly name: string;
  assignSpeakers(options: DiarizationOptions): Promise<TranscriptionResult>;
}

export interface ExtractAudioOptions {
  inputPath: string;
  outputPath: string;
}

export interface BurnSubtitlesOptions {
  inputVideoPath: string;
  subtitlePath: string;
  outputPath: string;
  style?: Record<string, unknown>;
}

export interface MediaProcessor {
  extractAudio(options: ExtractAudioOptions): Promise<{ audioPath: string; durationMs: number }>;
  burnSubtitles(options: BurnSubtitlesOptions): Promise<{ outputPath: string }>;
  probeDuration(mediaPath: string): Promise<number>;
}

export interface ProviderRegistry {
  transcription: TranscriptionProvider;
  diarization: DiarizationProvider;
  media: MediaProcessor;
}
