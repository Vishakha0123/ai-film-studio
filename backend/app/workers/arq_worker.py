"""Arq worker — run with:  arq app.workers.arq_worker.WorkerSettings"""

from arq.connections import RedisSettings

from app.config import get_settings
from app.services.pipeline import run_job


async def run_ai_job(ctx: dict, job_id: str) -> None:
    await run_job(job_id)


async def startup(ctx: dict) -> None:
    from app.services.film_production import recover_interrupted
    await recover_interrupted()  # long-film jobs a worker restart cut off continue where they stopped


class WorkerSettings:
    functions = [run_ai_job]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(get_settings().REDIS_URL or "redis://localhost:6379")
    max_jobs = 4
    job_timeout = 60 * 30  # video generation can take a while
