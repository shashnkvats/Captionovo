from datetime import UTC, datetime
from typing import Any

EXPORT_LABELS = {
    "txt": "TXT",
    "docx": "DOCX",
    "pdf": "PDF",
    "srt": "SRT",
    "vtt": "VTT",
    "json": "JSON",
    "mp4": "Subtitled MP4",
    "summary_docx": "Summary DOCX",
    "summary_pdf": "Summary PDF",
}


def _format_bytes(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024)} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def map_profile(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "name": row.get("name") or "",
        "email": row.get("email") or "",
        "planName": row["plan_name"],
        "creditsRemaining": row["credits_remaining"],
        "defaultLanguage": row["default_language"],
        "defaultTranscriptMode": row["default_transcript_mode"],
        "defaultSubtitleStyle": row["default_subtitle_style"],
        "dataRetentionDays": row["data_retention_days"],
        "notificationEmail": row["notification_email"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def map_project_summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "fileName": row["file_name"],
        "mediaType": row["media_type"],
        "durationMinutes": row["duration_minutes"],
        "language": row["language"],
        "status": row["status"],
        "uploadStatus": row["upload_status"],
        "processingState": row["processing_state"],
        "outputs": row["outputs"],
        "creditsUsed": row["credits_used"],
        "transcriptMode": row["transcript_mode"],
        "createdAt": row["created_at"],
        "updatedAt": row["updated_at"],
    }


def map_speaker(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "label": row["speaker_key"],
        "speakingPercent": float(row["speaking_percent"]),
    }
    if row.get("display_name"):
        result["displayName"] = row["display_name"]
    return result


def map_transcript_segment(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "startMs": row["start_ms"],
        "endMs": row["end_ms"],
        "speakerId": row.get("speaker_id") or "",
        "text": row["text"],
    }
    if row.get("confidence") is not None:
        result["confidence"] = float(row["confidence"])
    return result


def map_subtitle_segment(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "startMs": row["start_ms"],
        "endMs": row["end_ms"],
        "text": row["text"],
    }


def map_repurpose_output(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "type": row["output_type"],
        "title": row["title"],
        "content": row["content"],
        "status": row["status"],
    }


def map_export(row: dict[str, Any]) -> dict[str, Any]:
    fmt = row["format"]
    result = {
        "format": fmt,
        "label": EXPORT_LABELS.get(fmt, fmt.upper()),
        "status": row["status"],
    }
    if row.get("file_size_bytes"):
        result["fileSize"] = _format_bytes(row["file_size_bytes"])
    return result


def map_credit_transaction(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "projectTitle": row["project_title"],
        "durationMinutes": row["duration_minutes"],
        "creditsUsed": row["credits_used"],
        "outputTypes": row["output_types"],
        "date": row["created_at"],
    }


def usage_this_month(transactions: list[dict[str, Any]]) -> int:
    now = datetime.now(UTC)
    start_of_month = datetime(now.year, now.month, 1, tzinfo=UTC)
    total = 0
    for tx in transactions:
        created = datetime.fromisoformat(tx["created_at"].replace("Z", "+00:00"))
        if created >= start_of_month:
            total += tx["credits_used"]
    return total


def map_processing_event(row: dict[str, Any]) -> dict[str, Any]:
    result = {
        "id": row["id"],
        "stage": row["stage"],
        "status": row["status"],
        "startedAt": row["started_at"],
    }
    if row.get("message"):
        result["message"] = row["message"]
    if row.get("completed_at"):
        result["completedAt"] = row["completed_at"]
    return result
