"""Job creation and dispatch: Arq/Redis when REDIS_URL is set, otherwise in-process."""

from fastapi import BackgroundTasks
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AIJob
from app.services.pipeline import run_job


async def _enqueue_arq(job_id: str) -> None:
    from arq import create_pool
    from arq.connections import RedisSettings

    pool = await create_pool(RedisSettings.from_dsn(get_settings().REDIS_URL))
    try:
        await pool.enqueue_job("run_ai_job", job_id, _job_id=job_id)  # _job_id dedupes re-enqueues
    finally:
        await pool.close()


def create_job(db: Session, background: BackgroundTasks, *, project_id: str, user_id: str, task: str,
               params: dict | None = None, idempotency_key: str | None = None) -> AIJob:
    if idempotency_key:  # a retried request must not start a second (paid) job
        existing = db.scalars(select(AIJob).where(AIJob.idempotency_key == idempotency_key)).first()
        if existing and existing.user_id == user_id:
            return existing
    job = AIJob(project_id=project_id, user_id=user_id, task=task, params=params or {}, idempotency_key=idempotency_key)
    db.add(job)
    db.commit()
    if get_settings().REDIS_URL:
        background.add_task(_enqueue_arq, job.id)
    else:
        background.add_task(run_job, job.id)
    return job
