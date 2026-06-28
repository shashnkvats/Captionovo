import asyncio
from dataclasses import dataclass
from datetime import UTC, datetime

from captionovo.domain.processing import PipelineJobPayload


@dataclass
class JobRecord:
    id: str
    project_id: str
    user_id: str
    job_type: str
    status: str
    payload: PipelineJobPayload
    attempts: int
    max_attempts: int


def _map_job_record(row: dict) -> JobRecord:
    payload_data = row["payload"]
    payload = PipelineJobPayload(
        project_id=payload_data["projectId"],
        user_id=payload_data["userId"],
        outputs=payload_data["outputs"],
        transcript_mode=payload_data["transcriptMode"],
        language=payload_data["language"],
        media_type=payload_data["mediaType"],
        storage_path=payload_data["storagePath"],
    )
    return JobRecord(
        id=str(row["id"]),
        project_id=str(row["project_id"]),
        user_id=str(row["user_id"]),
        job_type=row["job_type"],
        status=row["status"],
        payload=payload,
        attempts=int(row.get("attempts") or 0),
        max_attempts=int(row.get("max_attempts") or 3),
    )


def _payload_to_db(payload: PipelineJobPayload) -> dict:
    return {
        "projectId": payload.project_id,
        "userId": payload.user_id,
        "outputs": payload.outputs,
        "transcriptMode": payload.transcript_mode,
        "language": payload.language,
        "mediaType": payload.media_type,
        "storagePath": payload.storage_path,
    }


class JobQueue:
    def __init__(self, admin, runner) -> None:
        self._admin = admin
        self._runner = runner

    async def enqueue_pipeline(self, payload: PipelineJobPayload) -> dict:
        idempotency_key = f"pipeline:{payload.project_id}"

        active = (
            self._admin.table("processing_jobs")
            .select("id, status")
            .eq("idempotency_key", idempotency_key)
            .in_("status", ["queued", "running"])
            .maybe_single()
            .execute()
        )
        if active.data:
            return {"job_id": active.data["id"], "inline": False}

        inserted = self._try_insert_job(
            project_id=payload.project_id,
            user_id=payload.user_id,
            job_type="project_pipeline",
            payload=payload,
            idempotency_key=idempotency_key,
        )

        if inserted:
            asyncio.create_task(self._runner.run_pipeline(payload, inserted.id))
            return {"job_id": inserted.id, "inline": True}

        asyncio.create_task(self._runner.run_pipeline(payload))
        return {"job_id": "inline", "inline": True}

    def claim_next_job(self) -> JobRecord | None:
        result = (
            self._admin.table("processing_jobs")
            .select("*")
            .eq("status", "queued")
            .order("created_at")
            .limit(1)
            .maybe_single()
            .execute()
        )
        if not result.data:
            return None

        data = result.data
        claimed = (
            self._admin.table("processing_jobs")
            .update(
                {
                    "status": "running",
                    "started_at": datetime.now(UTC).isoformat(),
                    "attempts": data.get("attempts", 0) + 1,
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            )
            .eq("id", data["id"])
            .eq("status", "queued")
            .select("*")
            .maybe_single()
            .execute()
        )
        if not claimed.data:
            return None
        return _map_job_record(claimed.data)

    def complete_job(self, job_id: str) -> None:
        self._admin.table("processing_jobs").update(
            {
                "status": "completed",
                "completed_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", job_id).execute()

    def fail_job(self, job_id: str, message: str) -> None:
        self._admin.table("processing_jobs").update(
            {
                "status": "failed",
                "error_message": message,
                "completed_at": datetime.now(UTC).isoformat(),
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", job_id).execute()

    def _try_insert_job(
        self,
        *,
        project_id: str,
        user_id: str,
        job_type: str,
        payload: PipelineJobPayload,
        idempotency_key: str,
    ) -> JobRecord | None:
        try:
            result = (
                self._admin.table("processing_jobs")
                .insert(
                    {
                        "project_id": project_id,
                        "user_id": user_id,
                        "job_type": job_type,
                        "status": "queued",
                        "payload": _payload_to_db(payload),
                        "current_step": "queued",
                        "idempotency_key": idempotency_key,
                    }
                )
                .select("*")
                .single()
                .execute()
            )
            if not result.data:
                return None
            return _map_job_record(result.data)
        except Exception as exc:
            print(f"[jobs] DB queue unavailable, running inline: {exc}")
            return None


async def start_job_poller(queue: JobQueue, runner, interval_ms: int = 5000):
    while True:
        job = queue.claim_next_job()
        if job:
            try:
                if job.job_type == "project_pipeline":
                    await runner.run_pipeline(job.payload, job.id)
                queue.complete_job(job.id)
            except Exception as exc:
                message = str(exc) if str(exc) else "Job failed"
                queue.fail_job(job.id, message)
        await asyncio.sleep(interval_ms / 1000)
