from fastapi import APIRouter, Depends, HTTPException

from captionovo.auth import AuthContext, get_auth_context
from captionovo.mappers import map_profile, usage_this_month
from captionovo.schemas import UpdateProfileBody

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
async def get_profile(auth: AuthContext = Depends(get_auth_context)):
    result = auth.supabase.table("profiles").select("*").eq("id", auth.user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail={"error": "Profile not found"})

    tx_result = (
        auth.supabase.table("credit_transactions")
        .select("credits_used, created_at")
        .eq("user_id", auth.user_id)
        .execute()
    )

    return {
        "profile": map_profile(result.data),
        "usageThisMonth": usage_this_month(tx_result.data or []),
    }


@router.patch("")
async def update_profile(body: UpdateProfileBody, auth: AuthContext = Depends(get_auth_context)):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if body.default_language is not None:
        updates["default_language"] = body.default_language
    if body.default_transcript_mode is not None:
        updates["default_transcript_mode"] = body.default_transcript_mode
    if body.data_retention_days is not None:
        updates["data_retention_days"] = body.data_retention_days
    if body.notification_email is not None:
        updates["notification_email"] = body.notification_email

    result = (
        auth.supabase.table("profiles")
        .update(updates)
        .eq("id", auth.user_id)
        .select("*")
        .single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=400, detail={"error": "Failed to update profile"})

    return {"profile": map_profile(result.data)}
