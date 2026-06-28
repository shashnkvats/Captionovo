import tempfile
from dataclasses import dataclass
from pathlib import Path


from captionovo.providers.stub import StubMediaProcessor


@dataclass
class ProbeResult:
    duration_minutes: int
    duration_seconds: int
    size_bytes: int


def _estimate_minutes_from_size(size_bytes: int) -> int:
    return max(1, (size_bytes + 1024 * 1024 - 1) // (1024 * 1024))


def _minutes_from_duration_ms(duration_ms: int) -> tuple[int, int]:
    duration_seconds = max(1, round(duration_ms / 1000))
    duration_minutes = max(1, (duration_seconds + 59) // 60)
    return duration_minutes, duration_seconds


class MediaProbeService:
    def __init__(self, media_processor=None) -> None:
        self._media = media_processor

    def probe(self, size_bytes: int, hint_minutes: int | None = None) -> ProbeResult:
        """Size-based fallback when FFmpeg probing is unavailable."""
        duration_minutes = max(1, hint_minutes or _estimate_minutes_from_size(size_bytes))
        return ProbeResult(
            duration_minutes=duration_minutes,
            duration_seconds=duration_minutes * 60,
            size_bytes=size_bytes,
        )

    async def probe_bytes(
        self, content: bytes, file_name: str, size_bytes: int | None = None
    ) -> ProbeResult:
        measured_size = size_bytes if size_bytes is not None else len(content)
        if not self._media or isinstance(self._media, StubMediaProcessor):
            return self.probe(measured_size)

        suffix = Path(file_name).suffix or ".bin"
        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as handle:
                handle.write(content)
                temp_path = handle.name
            duration_ms = await self._media.probe_duration(temp_path)
            duration_minutes, duration_seconds = _minutes_from_duration_ms(duration_ms)
            return ProbeResult(
                duration_minutes=duration_minutes,
                duration_seconds=duration_seconds,
                size_bytes=measured_size,
            )
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)
