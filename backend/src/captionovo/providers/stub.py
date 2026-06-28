from captionovo.domain.processing import (
    SpeakerDraft,
    TranscriptSegmentDraft,
    TranscriptionResult,
)


class StubTranscriptionProvider:
    name = "stub"

    async def transcribe(self, *, language: str, transcript_mode: str, media_path: str) -> TranscriptionResult:
        duration_ms = 45_000
        detected = "english" if language == "auto" else language
        return TranscriptionResult(
            detected_language=detected,
            duration_ms=duration_ms,
            speakers=[
                SpeakerDraft(speaker_key="speaker_1", display_name="Speaker 1", speaking_percent=62),
                SpeakerDraft(speaker_key="speaker_2", display_name="Speaker 2", speaking_percent=38),
            ],
            segments=[
                TranscriptSegmentDraft(
                    start_ms=0,
                    end_ms=12_000,
                    speaker_key="speaker_1",
                    text="Welcome to this episode. Today we are discussing product-market fit.",
                    confidence=0.94,
                ),
                TranscriptSegmentDraft(
                    start_ms=12_500,
                    end_ms=28_000,
                    speaker_key="speaker_2",
                    text="The hardest part is knowing when you have enough signal from users.",
                    confidence=0.91,
                ),
                TranscriptSegmentDraft(
                    start_ms=28_500,
                    end_ms=duration_ms,
                    speaker_key="speaker_1",
                    text="Exactly. Talk to users weekly and iterate on the transcript workflow.",
                    confidence=0.93,
                ),
            ],
        )


class StubDiarizationProvider:
    name = "stub"

    async def assign_speakers(self, *, media_path: str, segments: list) -> TranscriptionResult:
        duration_ms = segments[-1].end_ms if segments else 0
        return TranscriptionResult(
            duration_ms=duration_ms,
            speakers=[
                SpeakerDraft(speaker_key="speaker_1", display_name="Speaker 1", speaking_percent=62),
                SpeakerDraft(speaker_key="speaker_2", display_name="Speaker 2", speaking_percent=38),
            ],
            segments=[
                TranscriptSegmentDraft(
                    start_ms=s.start_ms,
                    end_ms=s.end_ms,
                    text=s.text,
                    speaker_key="speaker_1" if i % 2 == 0 else "speaker_2",
                    confidence=s.confidence,
                )
                for i, s in enumerate(segments)
            ],
        )


class StubMediaProcessor:
    async def extract_audio(self, *, input_path: str, output_path: str) -> dict:
        return {"audio_path": output_path, "duration_ms": 45_000}

    async def burn_subtitles(self, *, input_video_path: str, subtitle_path: str, output_path: str) -> dict:
        return {"output_path": output_path}

    async def probe_duration(self, media_path: str) -> int:
        return 45_000


def create_stub_providers() -> dict:
    return {
        "transcription": StubTranscriptionProvider(),
        "diarization": StubDiarizationProvider(),
        "media": StubMediaProcessor(),
    }
