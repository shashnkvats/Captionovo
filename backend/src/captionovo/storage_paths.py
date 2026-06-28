from pathlib import Path

ALLOWED_MIME_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/mp4",
    "audio/x-m4a",
    "video/mp4",
    "video/quicktime",
    "video/webm",
}

MAX_UPLOAD_BYTES = 500 * 1024 * 1024

_MIME_BY_EXT = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
}


def sanitize_file_name(file_name: str) -> str:
    base = Path(file_name).name or "upload"
    return "".join(c if c.isalnum() or c in "._-" else "_" for c in base)


def source_storage_path(user_id: str, project_id: str, file_name: str) -> str:
    safe = sanitize_file_name(file_name)
    return f"{user_id}/{project_id}/source/{safe}"


def extracted_audio_storage_path(user_id: str, project_id: str) -> str:
    return f"{user_id}/{project_id}/extracted/audio.wav"


def source_file_type(media_type: str) -> str:
    return "source_audio" if media_type == "audio" else "source_video"


def infer_mime_type(file_name: str) -> str | None:
    ext = Path(file_name).suffix.lower()
    return _MIME_BY_EXT.get(ext)
