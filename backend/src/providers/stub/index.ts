import type {
  DiarizationOptions,
  DiarizationProvider,
  ExtractAudioOptions,
  BurnSubtitlesOptions,
  MediaProcessor,
  TranscriptionOptions,
  TranscriptionProvider,
} from "../types.js";

export class StubTranscriptionProvider implements TranscriptionProvider {
  readonly name = "stub";

  async transcribe(options: TranscriptionOptions) {
    const durationMs = 45_000;
    return {
      detectedLanguage: options.language === "auto" ? ("english" as const) : options.language,
      durationMs,
      speakers: [
        { speakerKey: "speaker_1", displayName: "Speaker 1", speakingPercent: 62 },
        { speakerKey: "speaker_2", displayName: "Speaker 2", speakingPercent: 38 },
      ],
      segments: [
        {
          startMs: 0,
          endMs: 12_000,
          speakerKey: "speaker_1",
          text: "Welcome to this episode. Today we are discussing product-market fit.",
          confidence: 0.94,
        },
        {
          startMs: 12_500,
          endMs: 28_000,
          speakerKey: "speaker_2",
          text: "The hardest part is knowing when you have enough signal from users.",
          confidence: 0.91,
        },
        {
          startMs: 28_500,
          endMs: durationMs,
          speakerKey: "speaker_1",
          text: "Exactly. Talk to users weekly and iterate on the transcript workflow.",
          confidence: 0.93,
        },
      ],
    };
  }
}

export class StubDiarizationProvider implements DiarizationProvider {
  readonly name = "stub";

  async assignSpeakers(options: DiarizationOptions) {
    return {
      durationMs: options.segments.at(-1)?.endMs ?? 0,
      speakers: [
        { speakerKey: "speaker_1", displayName: "Speaker 1", speakingPercent: 62 },
        { speakerKey: "speaker_2", displayName: "Speaker 2", speakingPercent: 38 },
      ],
      segments: options.segments.map((segment, index) => ({
        ...segment,
        speakerKey: index % 2 === 0 ? "speaker_1" : "speaker_2",
      })),
    };
  }
}

export class StubMediaProcessor implements MediaProcessor {
  async extractAudio(options: ExtractAudioOptions) {
    return { audioPath: options.outputPath, durationMs: 45_000 };
  }

  async burnSubtitles(options: BurnSubtitlesOptions) {
    return { outputPath: options.outputPath };
  }

  async probeDuration(_mediaPath: string) {
    return 45_000;
  }
}

export function createStubProviders() {
  return {
    transcription: new StubTranscriptionProvider(),
    diarization: new StubDiarizationProvider(),
    media: new StubMediaProcessor(),
  };
}
