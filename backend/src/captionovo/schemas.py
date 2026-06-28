from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class UpdateProfileBody(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    default_language: Literal["auto", "english", "hindi", "hinglish"] | None = Field(
        default=None, alias="defaultLanguage"
    )
    default_transcript_mode: Literal["clean", "verbatim"] | None = Field(
        default=None, alias="defaultTranscriptMode"
    )
    data_retention_days: int | None = Field(default=None, ge=1, le=365, alias="dataRetentionDays")
    notification_email: bool | None = Field(default=None, alias="notificationEmail")

    model_config = {"populate_by_name": True}


class CreateProjectBody(BaseModel):
    title: str = Field(min_length=1)
    file_name: str = Field(min_length=1, alias="fileName")
    media_type: Literal["audio", "video"] | None = Field(default=None, alias="mediaType")
    duration_minutes: int = Field(default=0, ge=0, alias="durationMinutes")
    language: Literal["auto", "english", "hindi", "hinglish"] = "auto"
    outputs: list[str] = Field(default_factory=lambda: ["transcript"])
    transcript_mode: Literal["clean", "verbatim"] = Field(default="clean", alias="transcriptMode")

    model_config = {"populate_by_name": True}


class ConfirmUploadBody(BaseModel):
    duration_minutes: int | None = Field(default=None, ge=1, alias="durationMinutes")

    model_config = {"populate_by_name": True}


class UpdateProjectBody(BaseModel):
    title: str | None = Field(default=None, min_length=1)
    language: Literal["auto", "english", "hindi", "hinglish"] | None = None
    transcript_mode: Literal["clean", "verbatim"] | None = Field(default=None, alias="transcriptMode")

    model_config = {"populate_by_name": True}


class UpdateSegmentBody(BaseModel):
    text: str | None = Field(default=None, min_length=1)
    start_ms: int | None = Field(default=None, ge=0, alias="startMs")
    end_ms: int | None = Field(default=None, ge=0, alias="endMs")
    speaker_id: str | None = Field(default=None, alias="speakerId")

    model_config = {"populate_by_name": True}


class UpdateSpeakerBody(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, alias="displayName")

    model_config = {"populate_by_name": True}


class CheckoutBody(BaseModel):
    pack_id: str = Field(min_length=1, alias="packId")
    success_url: HttpUrl = Field(alias="successUrl")
    cancel_url: HttpUrl = Field(alias="cancelUrl")

    model_config = {"populate_by_name": True}


class ExportRequestBody(BaseModel):
    format: Literal[
        "txt", "docx", "pdf", "srt", "vtt", "json", "mp4", "summary_docx", "summary_pdf"
    ]
