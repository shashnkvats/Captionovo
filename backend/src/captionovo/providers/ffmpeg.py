import asyncio
import subprocess
from pathlib import Path


class FfmpegError(Exception):
    pass


class FfmpegMediaProcessor:
    def __init__(self, *, ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe") -> None:
        self._ffmpeg = ffmpeg_path
        self._ffprobe = ffprobe_path

    def _run(self, args: list[str]) -> str:
        try:
            result = subprocess.run(args, capture_output=True, text=True, check=False)
        except FileNotFoundError as exc:
            raise FfmpegError(
                f"{'ffmpeg' if 'ffmpeg' in args[0] else 'ffprobe'} not found. "
                "Install FFmpeg and ensure it is on PATH."
            ) from exc

        if result.returncode != 0:
            detail = (result.stderr or result.stdout or "command failed").strip()
            raise FfmpegError(detail)

        return result.stdout.strip()

    def _probe_duration_sync(self, media_path: str) -> int:
        output = self._run(
            [
                self._ffprobe,
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                media_path,
            ]
        )
        seconds = float(output)
        if seconds <= 0:
            raise FfmpegError(f"Could not determine media duration for {media_path}")
        return int(seconds * 1000)

    async def probe_duration(self, media_path: str) -> int:
        return await asyncio.to_thread(self._probe_duration_sync, media_path)

    def _extract_audio_sync(self, *, input_path: str, output_path: str) -> dict:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        self._run(
            [
                self._ffmpeg,
                "-y",
                "-i",
                input_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ar",
                "16000",
                "-ac",
                "1",
                output_path,
            ]
        )
        duration_ms = self._probe_duration_sync(output_path)
        return {"audio_path": output_path, "duration_ms": duration_ms}

    async def extract_audio(self, *, input_path: str, output_path: str) -> dict:
        return await asyncio.to_thread(
            self._extract_audio_sync, input_path=input_path, output_path=output_path
        )

    async def burn_subtitles(
        self, *, input_video_path: str, subtitle_path: str, output_path: str
    ) -> dict:
        # Phase 3 — stub return keeps optional pipeline stage from failing in dev.
        return {"output_path": output_path}
