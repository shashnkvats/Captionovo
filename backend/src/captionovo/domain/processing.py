from dataclasses import dataclass
from typing import Literal

OutputOption = Literal[
    "transcript",
    "speaker_labels",
    "subtitles",
    "summary",
    "burned_video",
    "repurpose",
]

ExportFormat = Literal[
    "txt",
    "docx",
    "pdf",
    "srt",
    "vtt",
    "json",
    "mp4",
    "summary_docx",
    "summary_pdf",
]

JobType = Literal["project_pipeline", "export", "repurpose", "burn_subtitles"]
JobStatus = Literal["queued", "running", "completed", "failed", "cancelled"]

PipelineStageName = Literal[
    "extracting_audio",
    "detecting_language",
    "transcribing",
    "persisting_transcript",
    "transcript_ready",
    "diarizing_speakers",
    "generating_subtitles",
    "generating_summary",
    "rendering_video",
    "preparing_editor",
]


@dataclass
class PipelineJobPayload:
    project_id: str
    user_id: str
    outputs: list[str]
    transcript_mode: str
    language: str
    media_type: str
    storage_path: str


@dataclass
class SpeakerDraft:
    speaker_key: str
    speaking_percent: float
    display_name: str | None = None


@dataclass
class TranscriptSegmentDraft:
    start_ms: int
    end_ms: int
    text: str
    speaker_key: str | None = None
    confidence: float | None = None


@dataclass
class TranscriptionResult:
    segments: list[TranscriptSegmentDraft]
    speakers: list[SpeakerDraft]
    duration_ms: int
    detected_language: str | None = None


CRITICAL_STAGES = {
    "extracting_audio",
    "detecting_language",
    "transcribing",
    "persisting_transcript",
}


def build_pipeline_stages(outputs: list[str]) -> list[str]:
    steps: list[str] = [
        "extracting_audio",
        "detecting_language",
        "transcribing",
        "persisting_transcript",
    ]
    if "speaker_labels" in outputs:
        steps.append("diarizing_speakers")
    if "subtitles" in outputs or "burned_video" in outputs:
        steps.append("generating_subtitles")
    if "summary" in outputs or "repurpose" in outputs:
        steps.append("generating_summary")
    if "burned_video" in outputs:
        steps.append("rendering_video")
    steps.append("preparing_editor")
    return steps
