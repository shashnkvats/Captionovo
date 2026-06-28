import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from captionovo.domain.processing import PipelineJobPayload, TranscriptionResult, build_pipeline_stages
from captionovo.persist_transcript import ensure_export_row, save_transcription
from captionovo.storage_paths import extracted_audio_storage_path


@dataclass
class PipelineContext:
    admin: object
    payload: PipelineJobPayload
    providers: dict
    credits: object
    events: object
    job_id: str | None = None
    work_dir: str = ""
    local_media_path: str | None = None
    local_audio_path: str | None = None
    transcription: TranscriptionResult | None = None
    failed_stages: list[str] = field(default_factory=list)
    has_transcript: bool = False


async def create_pipeline_context(deps: dict) -> PipelineContext:
    work_dir = tempfile.mkdtemp(prefix="captionovo-")
    return PipelineContext(work_dir=work_dir, **deps)


async def dispose_pipeline_context(ctx: PipelineContext) -> None:
    shutil.rmtree(ctx.work_dir, ignore_errors=True)


async def update_project_step(admin, project_id: str, step: str) -> None:
    admin.table("projects").update({"processing_state": step}).eq("id", project_id).execute()


async def emit_stage_event(ctx: PipelineContext, stage: str, status: str, message: str | None = None) -> None:
    ctx.events.emit(
        project_id=ctx.payload.project_id,
        job_id=ctx.job_id,
        stage=stage,
        status=status,
        message=message,
    )


async def _download_media(ctx: PipelineContext) -> str:
    if ctx.local_media_path:
        return ctx.local_media_path

    result = ctx.admin.storage.from_("uploads").download(ctx.payload.storage_path)
    if not result:
        raise RuntimeError("Failed to download source media")

    data = result if isinstance(result, bytes) else result
    local_path = str(Path(ctx.work_dir) / "source.bin")
    Path(local_path).write_bytes(data)
    ctx.local_media_path = local_path
    return local_path


async def _persist_extracted_audio(ctx: PipelineContext, audio_path: str, duration_ms: int) -> None:
    storage_path = extracted_audio_storage_path(ctx.payload.user_id, ctx.payload.project_id)
    audio_bytes = Path(audio_path).read_bytes()

    ctx.admin.storage.from_("uploads").upload(
        storage_path,
        audio_bytes,
        {"content-type": "audio/wav", "upsert": "true"},
    )

    ctx.admin.table("project_files").delete().eq("project_id", ctx.payload.project_id).eq(
        "file_type", "extracted_audio"
    ).execute()

    ctx.admin.table("project_files").insert(
        {
            "project_id": ctx.payload.project_id,
            "file_type": "extracted_audio",
            "storage_bucket": "uploads",
            "storage_path": storage_path,
            "mime_type": "audio/wav",
            "size_bytes": len(audio_bytes),
            "duration_seconds": max(1, round(duration_ms / 1000)),
        }
    ).execute()


async def _run_extract_audio(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "extracting_audio", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "extracting_audio")
    media_path = await _download_media(ctx)
    audio_path = str(Path(ctx.work_dir) / "audio.wav")
    result = await ctx.providers["media"].extract_audio(input_path=media_path, output_path=audio_path)
    ctx.local_audio_path = result["audio_path"]
    await _persist_extracted_audio(ctx, result["audio_path"], result.get("duration_ms", 0))
    await emit_stage_event(ctx, "extracting_audio", "completed")


async def _run_detect_language(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "detecting_language", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "detecting_language")
    await emit_stage_event(ctx, "detecting_language", "completed")


async def _run_transcribe(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "transcribing", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "transcribing")
    media_path = ctx.local_audio_path or ctx.local_media_path
    if not media_path:
        raise RuntimeError("Media not prepared for transcription")

    ctx.transcription = await ctx.providers["transcription"].transcribe(
        language=ctx.payload.language,
        transcript_mode=ctx.payload.transcript_mode,
        media_path=media_path,
    )

    if ctx.transcription.detected_language and ctx.payload.language == "auto":
        ctx.admin.table("projects").update({"language": ctx.transcription.detected_language}).eq(
            "id", ctx.payload.project_id
        ).execute()

    await emit_stage_event(ctx, "transcribing", "completed")


async def _run_persist_transcript(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "persisting_transcript", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "persisting_transcript")
    if not ctx.transcription:
        raise RuntimeError("Transcription missing before persist")

    await save_transcription(ctx.admin, ctx.payload.project_id, ctx.transcription)
    ctx.has_transcript = True

    ctx.admin.table("projects").update({"processing_state": "transcript_ready"}).eq(
        "id", ctx.payload.project_id
    ).execute()

    await emit_stage_event(ctx, "persisting_transcript", "completed")


async def _run_diarize(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "diarizing_speakers", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "diarizing_speakers")
    media_path = ctx.local_audio_path or ctx.local_media_path
    if not media_path or not ctx.transcription:
        raise RuntimeError("Transcription required before diarization")

    ctx.transcription = await ctx.providers["diarization"].assign_speakers(
        media_path=media_path, segments=ctx.transcription.segments
    )
    await save_transcription(ctx.admin, ctx.payload.project_id, ctx.transcription)
    await emit_stage_event(ctx, "diarizing_speakers", "completed")


async def _run_generate_subtitles(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "generating_subtitles", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "generating_subtitles")
    if not ctx.transcription:
        raise RuntimeError("Transcription required before subtitles")

    ctx.admin.table("subtitle_segments").delete().eq("project_id", ctx.payload.project_id).execute()

    subtitle_rows = [
        {
            "project_id": ctx.payload.project_id,
            "sort_order": index,
            "start_ms": segment.start_ms,
            "end_ms": segment.end_ms,
            "text": segment.text,
        }
        for index, segment in enumerate(ctx.transcription.segments)
    ]

    if subtitle_rows:
        ctx.admin.table("subtitle_segments").insert(subtitle_rows).execute()

    for fmt in ("srt", "vtt"):
        ensure_export_row(ctx.admin, ctx.payload.project_id, fmt)

    await emit_stage_event(ctx, "generating_subtitles", "completed")


async def _run_generate_summary(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "generating_summary", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "generating_summary")
    await emit_stage_event(ctx, "generating_summary", "completed")


async def _run_render_video(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "rendering_video", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "rendering_video")
    if not ctx.local_media_path:
        raise RuntimeError("Source video required for subtitle burn-in")

    subtitle_path = str(Path(ctx.work_dir) / "subtitles.srt")
    output_path = str(Path(ctx.work_dir) / "burned.mp4")
    Path(subtitle_path).write_text("WEBVTT\n")

    await ctx.providers["media"].burn_subtitles(
        input_video_path=ctx.local_media_path,
        subtitle_path=subtitle_path,
        output_path=output_path,
    )

    storage_path = f"{ctx.payload.user_id}/{ctx.payload.project_id}/burned.mp4"
    ensure_export_row(
        ctx.admin,
        ctx.payload.project_id,
        "mp4",
        status="not_generated",
        storage_path=storage_path,
    )
    await emit_stage_event(ctx, "rendering_video", "completed")


async def _run_prepare_editor(ctx: PipelineContext) -> None:
    await emit_stage_event(ctx, "preparing_editor", "started")
    await update_project_step(ctx.admin, ctx.payload.project_id, "preparing_editor")
    for fmt in ("txt", "docx", "pdf"):
        ensure_export_row(ctx.admin, ctx.payload.project_id, fmt)
    await emit_stage_event(ctx, "preparing_editor", "completed")


STAGE_RUNNERS = {
    "extracting_audio": (_run_extract_audio, True, lambda _ctx: True),
    "detecting_language": (_run_detect_language, True, lambda _ctx: True),
    "transcribing": (_run_transcribe, True, lambda _ctx: True),
    "persisting_transcript": (_run_persist_transcript, True, lambda _ctx: True),
    "diarizing_speakers": (
        _run_diarize,
        False,
        lambda ctx: "speaker_labels" in ctx.payload.outputs,
    ),
    "generating_subtitles": (
        _run_generate_subtitles,
        False,
        lambda ctx: "subtitles" in ctx.payload.outputs or "burned_video" in ctx.payload.outputs,
    ),
    "generating_summary": (
        _run_generate_summary,
        False,
        lambda ctx: "summary" in ctx.payload.outputs or "repurpose" in ctx.payload.outputs,
    ),
    "rendering_video": (
        _run_render_video,
        False,
        lambda ctx: "burned_video" in ctx.payload.outputs,
    ),
    "preparing_editor": (_run_prepare_editor, False, lambda _ctx: True),
}
