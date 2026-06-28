from fastapi import APIRouter, Depends, HTTPException

from captionovo.auth import AuthContext, get_auth_context
from captionovo.mappers import map_export, map_speaker, map_transcript_segment
from captionovo.schemas import ExportRequestBody, UpdateSegmentBody, UpdateSpeakerBody

router = APIRouter(prefix="/projects", tags=["transcript"])


@router.patch("/{project_id}/transcript/segments/{segment_id}")
async def update_segment(
    project_id: str,
    segment_id: str,
    body: UpdateSegmentBody,
    auth: AuthContext = Depends(get_auth_context),
):
    updates = {}
    if body.text is not None:
        updates["text"] = body.text
    if body.start_ms is not None:
        updates["start_ms"] = body.start_ms
    if body.end_ms is not None:
        updates["end_ms"] = body.end_ms
    if body.speaker_id is not None:
        updates["speaker_id"] = body.speaker_id

    result = (
        auth.supabase.table("transcript_segments")
        .update(updates)
        .eq("id", segment_id)
        .eq("project_id", project_id)
        .select("*")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Segment not found"})

    return {"segment": map_transcript_segment(result.data)}


@router.patch("/{project_id}/speakers/{speaker_id}")
async def update_speaker(
    project_id: str,
    speaker_id: str,
    body: UpdateSpeakerBody,
    auth: AuthContext = Depends(get_auth_context),
):
    result = (
        auth.supabase.table("speakers")
        .update({"display_name": body.display_name})
        .eq("id", speaker_id)
        .eq("project_id", project_id)
        .select("*")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Speaker not found"})

    return {"speaker": map_speaker(result.data)}


exports_router = APIRouter(prefix="/projects", tags=["exports"])


@exports_router.get("/{project_id}/exports")
async def list_exports(project_id: str, auth: AuthContext = Depends(get_auth_context)):
    result = (
        auth.supabase.table("exports")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at")
        .execute()
    )
    if hasattr(result, "error") and result.error:
        raise HTTPException(status_code=400, detail={"error": str(result.error)})

    return {"exports": [map_export(r) for r in (result.data or [])]}


@exports_router.post("/{project_id}/exports")
async def queue_export(
    project_id: str,
    body: ExportRequestBody,
    auth: AuthContext = Depends(get_auth_context),
):
    existing = (
        auth.supabase.table("exports")
        .select("*")
        .eq("project_id", project_id)
        .eq("format", body.format)
        .maybe_single()
        .execute()
    )

    if existing.data:
        auth.supabase.table("exports").update({"status": "generating"}).eq(
            "id", existing.data["id"]
        ).execute()
    else:
        auth.supabase.table("exports").insert(
            {"project_id": project_id, "format": body.format, "status": "generating"}
        ).execute()

    return {
        "message": "Export queued",
        "projectId": project_id,
        "format": body.format,
        "note": "Export worker not yet connected",
    }
