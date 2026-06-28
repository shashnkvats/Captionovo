from pathlib import Path

import httpx

from captionovo.domain.processing import (
    SpeakerDraft,
    TranscriptSegmentDraft,
    TranscriptionResult,
)

DEEPGRAM_LISTEN_URL = "https://api.deepgram.com/v1/listen"

# Captionovo language → Deepgram listen API language code
DEEPGRAM_LANGUAGE_CODES: dict[str, str | None] = {
    "english": "en",
    "hindi": "hi",
    "hinglish": "multi",
    "auto": None,
}

# Deepgram detected code → Captionovo profile language enum
DEEPGRAM_TO_INTERNAL_LANGUAGE: dict[str, str] = {
    "en": "english",
    "en-us": "english",
    "en-gb": "english",
    "hi": "hindi",
    "multi": "hinglish",
}

_MIME_BY_EXT = {
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
}


class DeepgramTranscriptionError(Exception):
    pass


def _content_type_for_path(media_path: str) -> str:
    ext = Path(media_path).suffix.lower()
    return _MIME_BY_EXT.get(ext, "application/octet-stream")


def _map_detected_language(detected: str | None) -> str | None:
    if not detected:
        return None
    normalized = detected.lower()
    if normalized in DEEPGRAM_TO_INTERNAL_LANGUAGE:
        return DEEPGRAM_TO_INTERNAL_LANGUAGE[normalized]
    base = normalized.split("-")[0]
    return DEEPGRAM_TO_INTERNAL_LANGUAGE.get(base)


def normalize_deepgram_response(data: dict) -> TranscriptionResult:
    """Map Deepgram JSON to internal TranscriptionResult — never expose raw API shape upstream."""
    results = data.get("results") or {}
    metadata = results.get("metadata") or {}
    duration_ms = int(float(metadata.get("duration") or 0) * 1000)

    channels = results.get("channels") or []
    if not channels:
        raise DeepgramTranscriptionError("Deepgram returned no transcription channels")

    alternative = (channels[0].get("alternatives") or [{}])[0]
    utterances = alternative.get("utterances") or []

    if not utterances:
        transcript = (alternative.get("transcript") or "").strip()
        if not transcript:
            raise DeepgramTranscriptionError("Deepgram returned an empty transcript")
        utterances = [
            {
                "start": 0.0,
                "end": max(duration_ms / 1000, 0.001),
                "transcript": transcript,
                "confidence": alternative.get("confidence"),
            }
        ]

    segments: list[TranscriptSegmentDraft] = []
    speaker_ms: dict[str, int] = {}

    for utterance in utterances:
        text = (utterance.get("transcript") or "").strip()
        if not text:
            continue

        start_ms = int(float(utterance.get("start", 0)) * 1000)
        end_ms = max(start_ms + 1, int(float(utterance.get("end", 0)) * 1000))
        speaker_key = None

        if utterance.get("speaker") is not None:
            speaker_key = f"speaker_{int(utterance['speaker']) + 1}"
            speaker_ms[speaker_key] = speaker_ms.get(speaker_key, 0) + (end_ms - start_ms)

        segments.append(
            TranscriptSegmentDraft(
                start_ms=start_ms,
                end_ms=end_ms,
                text=text,
                speaker_key=speaker_key,
                confidence=utterance.get("confidence"),
            )
        )

    if not segments:
        raise DeepgramTranscriptionError("Deepgram returned no usable transcript segments")

    if not duration_ms:
        duration_ms = segments[-1].end_ms

    total_speaking_ms = sum(speaker_ms.values()) or duration_ms
    speakers = [
        SpeakerDraft(
            speaker_key=key,
            display_name=f"Speaker {index + 1}",
            speaking_percent=round(100 * ms / total_speaking_ms, 1),
        )
        for index, (key, ms) in enumerate(sorted(speaker_ms.items()))
    ]

    detected_language = _map_detected_language(results.get("language") or metadata.get("language"))

    return TranscriptionResult(
        segments=segments,
        speakers=speakers,
        duration_ms=duration_ms,
        detected_language=detected_language,
    )


class PassthroughDiarizationProvider:
    """Keeps Deepgram-native speaker labels when the diarization stage runs."""

    name = "passthrough"

    async def assign_speakers(self, *, media_path: str, segments: list) -> TranscriptionResult:
        speaker_ms: dict[str, int] = {}
        for segment in segments:
            if segment.speaker_key:
                speaker_ms[segment.speaker_key] = speaker_ms.get(segment.speaker_key, 0) + (
                    segment.end_ms - segment.start_ms
                )

        total_ms = sum(speaker_ms.values()) or (
            segments[-1].end_ms - segments[0].start_ms if segments else 0
        )
        speakers = [
            SpeakerDraft(
                speaker_key=key,
                display_name=f"Speaker {index + 1}",
                speaking_percent=round(100 * ms / total_ms, 1) if total_ms else 0,
            )
            for index, (key, ms) in enumerate(sorted(speaker_ms.items()))
        ]

        duration_ms = segments[-1].end_ms if segments else 0
        return TranscriptionResult(segments=segments, speakers=speakers, duration_ms=duration_ms)


class DeepgramTranscriptionProvider:
    name = "deepgram"

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def _build_params(self, *, language: str, transcript_mode: str) -> dict[str, str]:
        params: dict[str, str] = {
            "model": "nova-3",
            "punctuate": "true",
            "utterances": "true",
            "diarize": "true",
            "smart_format": "true" if transcript_mode == "clean" else "false",
        }

        deepgram_language = DEEPGRAM_LANGUAGE_CODES.get(language, "en")
        if deepgram_language is None:
            params["detect_language"] = "true"
        else:
            params["language"] = deepgram_language

        return params

    async def transcribe(
        self, *, language: str, transcript_mode: str, media_path: str
    ) -> TranscriptionResult:
        params = self._build_params(language=language, transcript_mode=transcript_mode)
        content_type = _content_type_for_path(media_path)
        audio_bytes = Path(media_path).read_bytes()

        async with httpx.AsyncClient(timeout=600.0) as client:
            response = await client.post(
                DEEPGRAM_LISTEN_URL,
                params=params,
                headers={
                    "Authorization": f"Token {self._api_key}",
                    "Content-Type": content_type,
                },
                content=audio_bytes,
            )

        if response.status_code >= 400:
            detail = response.text.strip() or response.reason_phrase
            raise DeepgramTranscriptionError(f"Deepgram API error ({response.status_code}): {detail}")

        return normalize_deepgram_response(response.json())
