from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from captionovo.config import get_settings
from captionovo.routes.billing import router as billing_router
from captionovo.routes.billing import webhook_router
from captionovo.routes.profile import router as profile_router
from captionovo.routes.projects import router as projects_router
from captionovo.routes.transcript import exports_router, router as transcript_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Captionovo API", version="0.1.0")

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request, exc: HTTPException):
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.cors_origin],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "service": "captionovo-api",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    app.include_router(webhook_router)
    app.include_router(profile_router)
    app.include_router(billing_router)
    app.include_router(projects_router)
    app.include_router(transcript_router)
    app.include_router(exports_router)

    return app


app = create_app()


def run() -> None:
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "captionovo.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=True,
    )


if __name__ == "__main__":
    run()
