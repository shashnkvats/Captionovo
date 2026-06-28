from datetime import UTC, datetime

from captionovo.domain.processing import PipelineJobPayload
from captionovo.jobs.queue import JobQueue
from captionovo.pipeline.orchestrator import PipelineOrchestrator
from captionovo.providers.factory import create_providers
from captionovo.services.credits import CreditsService
from captionovo.services.processing_events import ProcessingEventsService
from captionovo.config import Settings, get_settings
from captionovo.supabase_client import create_admin_client


class JobRunner:
    def __init__(self, admin, orchestrator: PipelineOrchestrator) -> None:
        self._admin = admin
        self._orchestrator = orchestrator

    async def run_pipeline(self, payload: PipelineJobPayload, job_id: str | None = None) -> None:
        if job_id:
            self._admin.table("processing_jobs").update(
                {"current_step": "extracting_audio", "status": "running"}
            ).eq("id", job_id).execute()

        await self._orchestrator.run(payload, job_id)

        if job_id:
            self._admin.table("processing_jobs").update(
                {
                    "status": "completed",
                    "current_step": "completed",
                    "completed_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", job_id).execute()


def create_worker(settings: Settings | None = None, admin=None):
    settings = settings or get_settings()
    admin = admin or create_admin_client(settings)
    providers = create_providers(settings)
    credits = CreditsService(admin)
    events = ProcessingEventsService(admin)

    orchestrator = PipelineOrchestrator(
        admin=admin,
        providers=providers,
        credits=credits,
        events=events,
    )

    runner = JobRunner(admin, orchestrator)
    queue = JobQueue(admin, runner)

    return {"queue": queue, "runner": runner, "orchestrator": orchestrator, "credits": credits, "events": events}
