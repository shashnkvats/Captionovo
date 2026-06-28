from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from captionovo.auth import AuthContext, get_auth_context
from captionovo.config import Settings, get_settings
from captionovo.domain.billing import CreditReservation
from captionovo.domain.processing import PipelineJobPayload
from captionovo.jobs.worker_factory import create_worker
from captionovo.mappers import (
    map_export,
    map_processing_event,
    map_project_summary,
    map_repurpose_output,
    map_speaker,
    map_subtitle_segment,
    map_transcript_segment,
)
from captionovo.schemas import ConfirmUploadBody, CreateProjectBody, UpdateProjectBody
from captionovo.services.credits import InsufficientCreditsError
from captionovo.services.media_probe import MediaProbeService
from captionovo.services.upload import UploadVerificationError
from captionovo.providers.ffmpeg import FfmpegError
from captionovo.providers.factory import create_providers
from captionovo.storage_paths import extracted_audio_storage_path, source_file_type, source_storage_path
from captionovo.supabase_client import create_admin_client

router = APIRouter(prefix="/projects", tags=["projects"])

AUDIO_EXTENSIONS = {"mp3", "wav", "m4a"}
VIDEO_EXTENSIONS = {"mp4", "mov", "webm"}


def _infer_media_type(file_name: str) -> str | None:
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if ext in AUDIO_EXTENSIONS:
        return "audio"
    if ext in VIDEO_EXTENSIONS:
        return "video"
    return None


def _get_worker(settings: Settings):
    admin = create_admin_client(settings)
    return create_worker(settings, admin)


@router.get("")
async def list_projects(
    status: str | None = Query(default=None),
    auth: AuthContext = Depends(get_auth_context),
):
    query = (
        auth.supabase.table("projects")
        .select("*")
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)

    result = query.execute()
    if hasattr(result, "error") and result.error:
        raise HTTPException(status_code=400, detail={"error": str(result.error)})

    return {"projects": [map_project_summary(row) for row in (result.data or [])]}


@router.post("", status_code=201)
async def create_project(body: CreateProjectBody, auth: AuthContext = Depends(get_auth_context)):
    media_type = body.media_type or _infer_media_type(body.file_name)
    if not media_type:
        raise HTTPException(status_code=400, detail={"error": "Unsupported file format"})

    profile_result = (
        auth.supabase.table("profiles")
        .select("data_retention_days")
        .eq("id", auth.user_id)
        .single()
        .execute()
    )
    if not profile_result.data:
        raise HTTPException(status_code=404, detail={"error": "Profile not found"})

    retention_days = profile_result.data["data_retention_days"]
    media_expires_at = (datetime.now(UTC) + timedelta(days=retention_days)).isoformat()

    result = (
        auth.supabase.table("projects")
        .insert(
            {
                "user_id": auth.user_id,
                "title": body.title,
                "file_name": body.file_name,
                "media_type": media_type,
                "duration_minutes": 0,
                "language": body.language,
                "outputs": body.outputs,
                "transcript_mode": body.transcript_mode,
                "status": "draft",
                "upload_status": "draft",
                "processing_state": "queued",
                "media_expires_at": media_expires_at,
            }
        )
        .select("*")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=400, detail={"error": "Failed to create project"})

    return {"project": map_project_summary(result.data)}


@router.get("/{project_id}")
async def get_project(project_id: str, auth: AuthContext = Depends(get_auth_context)):
    project_result = (
        auth.supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not project_result.data:
        raise HTTPException(status_code=404, detail={"error": "Project not found"})

    project = project_result.data
    speakers = (
        auth.supabase.table("speakers")
        .select("*")
        .eq("project_id", project_id)
        .order("speaking_percent", desc=True)
        .execute()
    )
    segments = (
        auth.supabase.table("transcript_segments")
        .select("*")
        .eq("project_id", project_id)
        .order("sort_order")
        .execute()
    )
    subtitles = (
        auth.supabase.table("subtitle_segments")
        .select("*")
        .eq("project_id", project_id)
        .order("sort_order")
        .execute()
    )
    repurpose = (
        auth.supabase.table("repurpose_outputs").select("*").eq("project_id", project_id).execute()
    )
    exports = (
        auth.supabase.table("exports").select("*").eq("project_id", project_id).execute()
    )

    return {
        "project": {
            **map_project_summary(project),
            "segments": [map_transcript_segment(r) for r in (segments.data or [])],
            "speakers": [map_speaker(r) for r in (speakers.data or [])],
            "subtitles": [map_subtitle_segment(r) for r in (subtitles.data or [])],
            "repurpose": [map_repurpose_output(r) for r in (repurpose.data or [])],
            "exports": [map_export(r) for r in (exports.data or [])],
        }
    }


@router.get("/{project_id}/transcript")
async def get_transcript(project_id: str, auth: AuthContext = Depends(get_auth_context)):
    project_result = (
        auth.supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not project_result.data:
        raise HTTPException(status_code=404, detail={"error": "Project not found"})

    segments = (
        auth.supabase.table("transcript_segments")
        .select("*")
        .eq("project_id", project_id)
        .order("sort_order")
        .execute()
    )
    speakers = (
        auth.supabase.table("speakers")
        .select("*")
        .eq("project_id", project_id)
        .order("speaking_percent", desc=True)
        .execute()
    )

    return {
        "segments": [map_transcript_segment(r) for r in (segments.data or [])],
        "speakers": [map_speaker(r) for r in (speakers.data or [])],
    }


@router.get("/{project_id}/processing-events")
async def get_processing_events(project_id: str, auth: AuthContext = Depends(get_auth_context)):
    project_result = (
        auth.supabase.table("projects")
        .select("id")
        .eq("id", project_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not project_result.data:
        raise HTTPException(status_code=404, detail={"error": "Project not found"})

    result = (
        auth.supabase.table("processing_events")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at")
        .execute()
    )
    if hasattr(result, "error") and result.error:
        raise HTTPException(status_code=400, detail={"error": str(result.error)})

    return {"events": [map_processing_event(r) for r in (result.data or [])]}


@router.patch("/{project_id}")
async def update_project(
    project_id: str,
    body: UpdateProjectBody,
    auth: AuthContext = Depends(get_auth_context),
):
    updates = {}
    if body.title is not None:
        updates["title"] = body.title
    if body.language is not None:
        updates["language"] = body.language
    if body.transcript_mode is not None:
        updates["transcript_mode"] = body.transcript_mode

    result = (
        auth.supabase.table("projects")
        .update(updates)
        .eq("id", project_id)
        .select("*")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=400, detail={"error": "Failed to update project"})

    return {"project": map_project_summary(result.data)}


@router.delete("/{project_id}")
async def delete_project(project_id: str, auth: AuthContext = Depends(get_auth_context)):
    result = (
        auth.supabase.table("projects")
        .update({"deleted_at": datetime.now(UTC).isoformat()})
        .eq("id", project_id)
        .execute()
    )
    if hasattr(result, "error") and result.error:
        raise HTTPException(status_code=400, detail={"error": str(result.error)})

    return {"success": True}


@router.post("/{project_id}/upload-url")
async def create_upload_url(
    project_id: str,
    auth: AuthContext = Depends(get_auth_context),
    settings: Settings = Depends(get_settings),
):
    admin = create_admin_client(settings)
    project_result = (
        admin.table("projects")
        .select("id, file_name, user_id, media_type")
        .eq("id", project_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not project_result.data:
        raise HTTPException(status_code=404, detail={"error": "Project not found"})

    project = project_result.data
    storage_path = source_storage_path(auth.user_id, project_id, project["file_name"])

    signed = admin.storage.from_("uploads").create_signed_upload_url(storage_path)

    admin.table("projects").update(
        {"storage_path": storage_path, "upload_status": "uploading"}
    ).eq("id", project_id).execute()

    return {
        "uploadUrl": signed.get("signedUrl") or signed.get("signed_url"),
        "token": signed["token"],
        "path": storage_path,
    }


@router.post("/{project_id}/confirm-upload")
async def confirm_upload(
    project_id: str,
    body: ConfirmUploadBody | None = None,
    auth: AuthContext = Depends(get_auth_context),
    settings: Settings = Depends(get_settings),
):
    body = body or ConfirmUploadBody()
    admin = create_admin_client(settings)
    worker = _get_worker(settings)
    credits = worker["credits"]

    from captionovo.services.upload import UploadService

    upload_service = UploadService(admin)
    providers = create_providers(settings)
    media_probe = MediaProbeService(providers["media"])

    project_result = (
        admin.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not project_result.data:
        raise HTTPException(status_code=404, detail={"error": "Project not found"})

    project = project_result.data
    if not project.get("storage_path"):
        raise HTTPException(status_code=400, detail={"error": "Upload file before confirming"})

    if project["upload_status"] == "ready_to_process":
        return {
            "message": "Upload already confirmed",
            "project": map_project_summary(project),
            "durationMinutes": project["duration_minutes"],
            "creditsReserved": project["credits_reserved"],
        }

    try:
        verified = upload_service.verify_object(project["storage_path"], project["file_name"])
        probe = await media_probe.probe_bytes(
            verified.content, project["file_name"], verified.size_bytes
        )

        credits.reserve(
            CreditReservation(
                user_id=auth.user_id,
                project_id=project_id,
                amount=probe.duration_minutes,
                project_title=project["title"],
                output_types=project["outputs"],
                duration_minutes=probe.duration_minutes,
                idempotency_key=f"reserve:{project_id}",
            )
        )

        admin.table("project_files").delete().eq("project_id", project_id).eq(
            "file_type", source_file_type(project["media_type"])
        ).execute()

        admin.table("project_files").insert(
            {
                "project_id": project_id,
                "file_type": source_file_type(project["media_type"]),
                "storage_bucket": "uploads",
                "storage_path": verified.storage_path,
                "mime_type": verified.mime_type,
                "size_bytes": verified.size_bytes,
                "duration_seconds": probe.duration_seconds,
            }
        ).execute()

        updated_result = (
            admin.table("projects")
            .update(
                {
                    "upload_status": "ready_to_process",
                    "duration_minutes": probe.duration_minutes,
                    "status": "draft",
                }
            )
            .eq("id", project_id)
            .select("*")
            .single()
            .execute()
        )

        if not updated_result.data:
            raise HTTPException(status_code=400, detail={"error": "Failed to confirm upload"})

        return {
            "message": "Upload confirmed",
            "project": map_project_summary(updated_result.data),
            "durationMinutes": probe.duration_minutes,
            "creditsReserved": probe.duration_minutes,
        }
    except UploadVerificationError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
    except FfmpegError as exc:
        raise HTTPException(status_code=400, detail={"error": str(exc)}) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail={"error": str(exc)}) from exc
    except InsufficientCreditsError as exc:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "Insufficient credits",
                "creditsRemaining": exc.credits_remaining,
                "creditsNeeded": exc.credits_needed,
            },
        ) from exc


@router.post("/{project_id}/process")
async def process_project(
    project_id: str,
    auth: AuthContext = Depends(get_auth_context),
    settings: Settings = Depends(get_settings),
):
    admin = create_admin_client(settings)
    worker = _get_worker(settings)
    queue = worker["queue"]

    project_result = (
        admin.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", auth.user_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not project_result.data:
        raise HTTPException(status_code=404, detail={"error": "Project not found"})

    project = project_result.data
    if project["upload_status"] != "ready_to_process":
        raise HTTPException(status_code=400, detail={"error": "Confirm upload before starting processing"})

    if not project.get("storage_path"):
        raise HTTPException(status_code=400, detail={"error": "Upload file before starting processing"})

    if (
        project["status"] == "processing"
        and project["processing_state"] not in ("queued", "failed")
    ):
        return {
            "message": "Processing already in progress",
            "projectId": project_id,
            "processingState": project["processing_state"],
        }

    admin.table("projects").update(
        {"processing_state": "queued", "status": "processing"}
    ).eq("id", project_id).execute()

    payload = PipelineJobPayload(
        project_id=project_id,
        user_id=auth.user_id,
        outputs=project["outputs"],
        transcript_mode=project["transcript_mode"],
        language=project["language"],
        media_type=project["media_type"],
        storage_path=project["storage_path"],
    )

    result = await queue.enqueue_pipeline(payload)

    return {
        "message": "Processing queued",
        "projectId": project_id,
        "jobId": result["job_id"],
    }
