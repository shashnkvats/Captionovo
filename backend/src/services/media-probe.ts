export interface ProbeResult {
  durationMinutes: number;
  durationSeconds: number;
  sizeBytes: number;
}

/** Stub probe until FFmpeg lands in Phase 2. Uses client hint when provided. */
export class MediaProbeService {
  probe(sizeBytes: number, hintMinutes?: number): ProbeResult {
    const durationMinutes = Math.max(1, hintMinutes ?? estimateMinutesFromSize(sizeBytes));
    return {
      durationMinutes,
      durationSeconds: durationMinutes * 60,
      sizeBytes,
    };
  }
}

function estimateMinutesFromSize(sizeBytes: number): number {
  // Rough fallback: ~1 MB per minute of compressed audio/video
  return Math.max(1, Math.ceil(sizeBytes / (1024 * 1024)));
}
