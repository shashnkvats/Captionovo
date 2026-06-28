from dataclasses import dataclass
from typing import Annotated

import httpx
from fastapi import Depends, Header, HTTPException
from supabase import Client
from supabase_auth.errors import AuthApiError

from captionovo.config import Settings, get_settings
from captionovo.supabase_client import create_user_client


@dataclass
class AuthContext:
    access_token: str
    user_id: str
    supabase: Client


async def get_auth_context(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> AuthContext:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail={"error": "Missing or invalid Authorization header"})

    access_token = authorization.removeprefix("Bearer ").strip()

    try:
        supabase = create_user_client(settings, access_token)
        response = supabase.auth.get_user(access_token)
    except (AuthApiError, httpx.HTTPError) as exc:
        raise HTTPException(status_code=401, detail={"error": "Invalid or expired session"}) from exc

    if response is None or response.user is None:
        raise HTTPException(status_code=401, detail={"error": "Invalid or expired session"})

    return AuthContext(access_token=access_token, user_id=response.user.id, supabase=supabase)
