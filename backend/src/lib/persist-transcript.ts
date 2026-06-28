import type { TranscriptionResult } from "../domain/processing.js";
import type { AppSupabaseClient } from "./supabase.js";

export async function saveTranscription(
  admin: AppSupabaseClient,
  projectId: string,
  transcription: TranscriptionResult,
) {
  await admin.from("speakers").delete().eq("project_id", projectId);
  await admin.from("transcript_segments").delete().eq("project_id", projectId);

  const speakerKeyToId = new Map<string, string>();
  for (const speaker of transcription.speakers) {
    const { data, error } = await admin
      .from("speakers")
      .insert({
        project_id: projectId,
        speaker_key: speaker.speakerKey,
        display_name: speaker.displayName ?? null,
        speaking_percent: speaker.speakingPercent,
      })
      .select("id, speaker_key")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Failed to save speaker");
    speakerKeyToId.set(data.speaker_key, data.id);
  }

  const segmentRows = transcription.segments.map((segment, index) => ({
    project_id: projectId,
    sort_order: index,
    start_ms: segment.startMs,
    end_ms: segment.endMs,
    text: segment.text,
    confidence: segment.confidence ?? null,
    speaker_id: segment.speakerKey ? speakerKeyToId.get(segment.speakerKey) ?? null : null,
  }));

  if (segmentRows.length > 0) {
    const { error } = await admin.from("transcript_segments").insert(segmentRows);
    if (error) throw new Error(error.message);
  }
}
