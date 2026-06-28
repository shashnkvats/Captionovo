from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def _load_env_files() -> None:
    for path in (
        BACKEND_ROOT / ".env",
        REPO_ROOT / ".env",
        REPO_ROOT / "frontend" / ".env.local",
    ):
        if path.exists():
            load_dotenv(path, override=False)


_load_env_files()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore", populate_by_name=True)

    port: int = Field(default=4000, validation_alias="PORT")
    supabase_url: str = Field(validation_alias="SUPABASE_URL")
    supabase_anon_key: str = Field(validation_alias="SUPABASE_ANON_KEY")
    supabase_service_role_key: str = Field(validation_alias="SUPABASE_SERVICE_ROLE_KEY")
    cors_origin: str = Field(default="http://localhost:3000", validation_alias="CORS_ORIGIN")
    transcription_provider: Literal["stub", "deepgram", "assemblyai"] = Field(
        default="stub", validation_alias="TRANSCRIPTION_PROVIDER"
    )
    deepgram_api_key: str | None = Field(default=None, validation_alias="DEEPGRAM_API_KEY")
    ffmpeg_path: str = Field(default="ffmpeg", validation_alias="FFMPEG_PATH")
    ffprobe_path: str = Field(default="ffprobe", validation_alias="FFPROBE_PATH")
    stripe_secret_key: str | None = Field(default=None, validation_alias="STRIPE_SECRET_KEY")
    stripe_webhook_secret: str | None = Field(default=None, validation_alias="STRIPE_WEBHOOK_SECRET")


@lru_cache
def get_settings() -> Settings:
    import os

    if not os.getenv("SUPABASE_URL") and os.getenv("NEXT_PUBLIC_SUPABASE_URL"):
        os.environ.setdefault("SUPABASE_URL", os.environ["NEXT_PUBLIC_SUPABASE_URL"])
    if not os.getenv("SUPABASE_ANON_KEY") and os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"):
        os.environ.setdefault("SUPABASE_ANON_KEY", os.environ["NEXT_PUBLIC_SUPABASE_ANON_KEY"])

    try:
        return Settings()  # type: ignore[call-arg]
    except Exception as exc:
        msg = (
            "Missing or invalid environment variables in backend/.env\n"
            "Create backend/.env with: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY\n"
            "Get keys from: https://supabase.com/dashboard/project/zzxsxccapuwefkvqixad/settings/api"
        )
        raise RuntimeError(msg) from exc
