from datetime import UTC, datetime


class ProcessingEventsService:
    def __init__(self, admin) -> None:
        self._admin = admin

    def emit(
        self,
        *,
        project_id: str,
        stage: str,
        status: str,
        job_id: str | None = None,
        message: str | None = None,
        metadata: dict | None = None,
    ) -> None:
        completed_at = None
        if status in ("completed", "failed"):
            completed_at = datetime.now(UTC).isoformat()

        try:
            self._admin.table("processing_events").insert(
                {
                    "project_id": project_id,
                    "job_id": job_id,
                    "stage": stage,
                    "status": status,
                    "message": message,
                    "metadata": metadata or {},
                    "completed_at": completed_at,
                }
            ).execute()
        except Exception as exc:
            print(f"[processing-events] failed to emit: {exc}")
