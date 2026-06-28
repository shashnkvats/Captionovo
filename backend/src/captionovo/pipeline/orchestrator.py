from captionovo.domain.processing import PipelineJobPayload, build_pipeline_stages
from captionovo.pipeline.context import (
    STAGE_RUNNERS,
    PipelineContext,
    create_pipeline_context,
    dispose_pipeline_context,
    emit_stage_event,
)


class PipelineOrchestrator:
    def __init__(self, *, admin, providers, credits, events) -> None:
        self._admin = admin
        self._providers = providers
        self._credits = credits
        self._events = events

    async def run(self, payload: PipelineJobPayload, job_id: str | None = None) -> None:
        ctx = await create_pipeline_context(
            {
                "admin": self._admin,
                "payload": payload,
                "providers": self._providers,
                "credits": self._credits,
                "events": self._events,
                "job_id": job_id,
            }
        )

        try:
            for step_name in build_pipeline_stages(payload.outputs):
                runner_info = STAGE_RUNNERS.get(step_name)
                if not runner_info:
                    continue
                run_fn, critical, should_run = runner_info
                if not should_run(ctx):
                    continue

                try:
                    await run_fn(ctx)
                except Exception as exc:
                    message = str(exc) if str(exc) else "Stage failed"
                    await emit_stage_event(ctx, step_name, "failed", message)
                    if critical:
                        raise
                    ctx.failed_stages.append(step_name)

            await self._mark_completed(ctx, payload)
        except Exception as exc:
            await self._mark_failed(ctx, payload, exc)
            raise
        finally:
            await dispose_pipeline_context(ctx)

    async def _mark_completed(self, ctx: PipelineContext, payload: PipelineJobPayload) -> None:
        is_partial = len(ctx.failed_stages) > 0

        self._admin.table("projects").update(
            {"processing_state": "completed", "status": "partial" if is_partial else "completed"}
        ).eq("id", payload.project_id).execute()

        if ctx.has_transcript:
            self._credits.commit_from_reservation(payload.project_id, payload.user_id)
        else:
            self._credits.release(payload.project_id, payload.user_id)

        message = (
            f"Partial completion: {', '.join(ctx.failed_stages)}"
            if is_partial
            else "All stages completed"
        )
        ctx.events.emit(
            project_id=payload.project_id,
            job_id=ctx.job_id,
            stage="pipeline",
            status="completed",
            message=message,
        )

    async def _mark_failed(self, ctx: PipelineContext, payload: PipelineJobPayload, error: Exception) -> None:
        message = str(error) if str(error) else "Processing failed"

        self._admin.table("projects").update(
            {"processing_state": "failed", "status": "failed"}
        ).eq("id", payload.project_id).execute()

        if ctx.has_transcript:
            self._admin.table("projects").update(
                {"status": "partial", "processing_state": "transcript_ready"}
            ).eq("id", payload.project_id).execute()
            self._credits.commit_from_reservation(payload.project_id, payload.user_id)
        else:
            self._credits.release(payload.project_id, payload.user_id)

        ctx.events.emit(
            project_id=payload.project_id,
            job_id=ctx.job_id,
            stage="pipeline",
            status="failed",
            message=message,
        )
        print(f"[pipeline] project {payload.project_id} failed: {message}")
