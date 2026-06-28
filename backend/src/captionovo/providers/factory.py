from captionovo.config import Settings
from captionovo.providers.deepgram import (
    DeepgramTranscriptionProvider,
    PassthroughDiarizationProvider,
)
from captionovo.providers.ffmpeg import FfmpegMediaProcessor
from captionovo.providers.stub import (
    StubDiarizationProvider,
    StubMediaProcessor,
    StubTranscriptionProvider,
)


def create_providers(settings: Settings) -> dict:
    use_ffmpeg = settings.transcription_provider != "stub"

    if use_ffmpeg:
        media = FfmpegMediaProcessor(
            ffmpeg_path=settings.ffmpeg_path,
            ffprobe_path=settings.ffprobe_path,
        )
    else:
        media = StubMediaProcessor()

    if settings.transcription_provider == "assemblyai":
        raise RuntimeError("TRANSCRIPTION_PROVIDER=assemblyai is not implemented yet")

    if settings.transcription_provider == "deepgram":
        if not settings.deepgram_api_key:
            raise RuntimeError(
                "DEEPGRAM_API_KEY is required when TRANSCRIPTION_PROVIDER=deepgram"
            )
        return {
            "transcription": DeepgramTranscriptionProvider(settings.deepgram_api_key),
            "diarization": PassthroughDiarizationProvider(),
            "media": media,
        }

    return {
        "transcription": StubTranscriptionProvider(),
        "diarization": StubDiarizationProvider(),
        "media": media,
    }
