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
    dispatch(background, job)
    return job


def dispatch(background: BackgroundTasks, job: AIJob) -> None:
    """Run a created job after the response: on the Arq worker with Redis, otherwise in-process."""
    if get_settings().REDIS_URL:
        background.add_task(_enqueue_arq, job.id)
    else:
        background.add_task(run_job, job.id)


def fail_interrupted_jobs() -> int:
    """After a restart (e.g. a deploy), short jobs that were queued or running in this process are gone.
    Mark them failed so the studio stops waiting and the creator can try again. Long-film jobs are
    resumed separately by film_production.recover_interrupted(). Only without Redis: there the
    worker owns the jobs."""
    from app.db import SessionLocal
    from app.services.film_production import FILM_TASKS_NAMES
    with SessionLocal() as db:
        lost = db.scalars(select(AIJob).where(AIJob.status.in_(("queued", "running")),
                                              AIJob.task.not_in(FILM_TASKS_NAMES))).all()
        for job in lost:
            job.status = "failed"
            job.error = "The server restarted while this was running — please try again."
        db.commit()
        return len(lost)
