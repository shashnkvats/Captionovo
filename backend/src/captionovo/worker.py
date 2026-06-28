import asyncio

from captionovo.config import get_settings
from captionovo.jobs.queue import start_job_poller
from captionovo.jobs.worker_factory import create_worker


async def main() -> None:
    settings = get_settings()
    worker = create_worker(settings)
    print("[worker] Captionovo job poller started (interval 5s)")
    await start_job_poller(worker["queue"], worker["runner"], interval_ms=5000)


def run() -> None:
    asyncio.run(main())


if __name__ == "__main__":
    run()
