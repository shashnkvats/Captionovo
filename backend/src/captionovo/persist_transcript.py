from captionovo.domain.processing import TranscriptionResult


async def save_transcription(admin, project_id: str, transcription: TranscriptionResult) -> None:
    admin.table("speakers").delete().eq("project_id", project_id).execute()
    admin.table("transcript_segments").delete().eq("project_id", project_id).execute()

    speaker_key_to_id: dict[str, str] = {}
    for speaker in transcription.speakers:
        result = (
            admin.table("speakers")
            .insert(
                {
                    "project_id": project_id,
                    "speaker_key": speaker.speaker_key,
                    "display_name": speaker.display_name,
                    "speaking_percent": speaker.speaking_percent,
                }
            )
            .select("id, speaker_key")
            .single()
            .execute()
        )
        if not result.data:
            raise RuntimeError("Failed to save speaker")
        speaker_key_to_id[result.data["speaker_key"]] = result.data["id"]

    segment_rows = []
    for index, segment in enumerate(transcription.segments):
        speaker_id = None
        if segment.speaker_key:
            speaker_id = speaker_key_to_id.get(segment.speaker_key)
        segment_rows.append(
            {
                "project_id": project_id,
                "sort_order": index,
                "start_ms": segment.start_ms,
                "end_ms": segment.end_ms,
                "text": segment.text,
                "confidence": segment.confidence,
                "speaker_id": speaker_id,
            }
        )

    if segment_rows:
        admin.table("transcript_segments").insert(segment_rows).execute()


def ensure_export_row(
    admin,
    project_id: str,
    fmt: str,
    *,
    status: str = "not_generated",
    storage_path: str | None = None,
) -> None:
    existing = (
        admin.table("exports")
        .select("id")
        .eq("project_id", project_id)
        .eq("format", fmt)
        .maybe_single()
        .execute()
    )
    if existing.data:
        return

    admin.table("exports").insert(
        {
            "project_id": project_id,
            "format": fmt,
            "status": status,
            "storage_path": storage_path,
        }
    ).execute()
