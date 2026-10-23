"""Long film (10 minutes – 2 hours): shared rules — sizes, budget cap, pause, provider costs, restart recovery.

The film is made in small saved units instead of one giant request:
    story bible → scene outline (batches) → each scene's script + shots → one clip (+ voice) per shot
    → a preview file per scene → the final film joined from the scene files.
Every scene and shot is a database row with its own status, so finished work survives a restart and a retry only
redoes what failed. See film_planner.py, scene_generator.py and film_renderer.py.
"""

import asyncio
import logging
import math

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.models import AIJob, FilmProduction, FilmScene, FilmShot, Project

log = logging.getLogger("cineai.film")

MIN_SECONDS, MAX_SECONDS = 60, 2 * 60 * 60          # 1 minute (tests/pilots) to 2 hours
SCENE_SECONDS = 90                                    # average scene length the outline aims for
OUTLINE_BATCH = 12                                    # scenes written per story-model call
MAX_SHOT_ATTEMPTS = 3                                 # per shot, across runs; then it waits for a manual retry
FILM_TASKS_NAMES = ("film_plan", "film_generate", "film_render", "film_rewrite_scene")
FRAME_SIZES = {"16:9": (1280, 720), "9:16": (720, 1280), "1:1": (720, 720)}


class BudgetReached(Exception):
    """The next paid call would go over the film's budget cap: stop scheduling paid work."""


class Paused(Exception):
    """The creator asked to pause: stop between shots."""


def scene_count(target_seconds: int) -> int:
    return max(3, min(150, round(target_seconds / SCENE_SECONDS)))


def shots_for(seconds: float, shot_seconds: int) -> int:
    return max(1, math.ceil(seconds / shot_seconds))


def production_of(db: Session, project_id: str, *, with_shots: bool = False) -> FilmProduction | None:
    q = select(FilmProduction).where(FilmProduction.project_id == project_id)
    if with_shots:  # status pages read every scene and shot: load them in two queries, not one per scene
        q = q.options(selectinload(FilmProduction.scenes).selectinload(FilmScene.shots))
    return db.scalars(q).first()


def frame_size(project: Project) -> tuple[int, int]:
    return FRAME_SIZES.get((project.brief or {}).get("aspectRatio", "16:9"), FRAME_SIZES["16:9"])


# ---------- Which providers cost money right now ----------

def live_providers() -> dict[str, bool]:
    s = get_settings()
    return {"story": s.STORY_PROVIDER != "mock", "image": s.IMAGE_PROVIDER != "mock",
            "video": s.VIDEO_PROVIDER != "mock", "tts": s.TTS_PROVIDER != "mock"}


def shot_cost(shot_seconds: float, dialogue_lines: int, quality: str, live: dict[str, bool] | None = None) -> float:
    """What one shot costs with the providers that are switched on (0 with the free mock providers)."""
    s, live = get_settings(), live or live_providers()
    rate = s.COST_PER_VIDEO_SECOND_FINAL if quality == "final" else s.COST_PER_VIDEO_SECOND_DRAFT
    cost = 0.0
    if live["image"]:
        cost += s.COST_PER_IMAGE
    if live["video"]:
        cost += rate * shot_seconds
    if live["tts"]:
        cost += s.COST_PER_TTS_LINE * dialogue_lines
    return cost


def story_call_cost(live: dict[str, bool] | None = None) -> float:
    return get_settings().COST_PER_STORY_CALL if (live or live_providers())["story"] else 0.0


def check_budget(prod: FilmProduction, next_cost: float) -> None:
    """Hard cap: refuse the next paid call if it would take the film over its budget."""
    if next_cost > 0 and prod.spent + next_cost > prod.budget_cap + 1e-9:
        raise BudgetReached(f"Budget cap ${prod.budget_cap:.2f} reached (spent ${prod.spent:.2f}; next step costs about ${next_cost:.2f}).")


def check_pause(db: Session, prod: FilmProduction) -> None:
    db.refresh(prod)  # the pause button writes from another request
    if prod.pause_requested:
        raise Paused()


def estimate(db: Session, prod: FilmProduction) -> dict:
    """Calls and cost still to come, with the providers that are on now and with all of them on."""
    live, all_live = live_providers(), {"story": True, "image": True, "video": True, "tts": True}
    s = get_settings()
    scenes = list(prod.scenes)
    shots = remaining_shots = video_seconds = lines = story_calls = 0
    for sc in scenes:
        if sc.shots:
            todo = [sh for sh in sc.shots if sh.status != "done"]
            shots += len(sc.shots)
            remaining_shots += len(todo)
            video_seconds += sum(sh.seconds for sh in todo)
            lines += sum(len(sh.dialogue or []) for sh in todo)
        else:
            n = shots_for(sc.target_seconds, prod.shot_seconds)
            shots += n
            remaining_shots += n
            video_seconds += sc.target_seconds
            lines += math.ceil(n / 2)
            story_calls += 1

    def cost(on: dict) -> float:
        rate = s.COST_PER_VIDEO_SECOND_FINAL if prod.quality == "final" else s.COST_PER_VIDEO_SECOND_DRAFT
        return round((s.COST_PER_STORY_CALL * story_calls if on["story"] else 0)
                     + (s.COST_PER_IMAGE * remaining_shots if on["image"] else 0)
                     + (rate * video_seconds if on["video"] else 0)
                     + (s.COST_PER_TTS_LINE * lines if on["tts"] else 0), 2)

    return {"scenes": len(scenes), "shots": shots, "remainingShots": remaining_shots,
            "videoSeconds": round(video_seconds), "storyCalls": story_calls, "dialogueLines": lines,
            "estimatedCost": cost(live), "fullProviderCost": cost(all_live), "currency": "USD",
            "budgetCap": prod.budget_cap, "spent": round(prod.spent, 4), "liveProviders": live,
            "quality": prod.quality}


def active_film_job(db: Session, project_id: str) -> AIJob | None:
    return db.scalars(select(AIJob).where(AIJob.project_id == project_id, AIJob.task.in_(FILM_TASKS_NAMES),
                                          AIJob.status.in_(("queued", "running")))).first()


def progress(prod: FilmProduction) -> dict:
    scenes = list(prod.scenes)
    planned_shots = sum(len(sc.shots) if sc.shots else shots_for(sc.target_seconds, prod.shot_seconds) for sc in scenes)
    done = sum(1 for sc in scenes for sh in sc.shots if sh.status == "done")
    failed = sum(1 for sc in scenes for sh in sc.shots if sh.status == "failed")
    return {"scenes": len(scenes), "scenesDone": sum(sc.status == "done" for sc in scenes),
            "scenesFailed": sum(sc.status == "failed" for sc in scenes),
            "shots": planned_shots, "shotsDone": done, "shotsFailed": failed,
            "percent": round(100 * done / planned_shots) if planned_shots else 0}


def job_stopped(db: Session, job: AIJob) -> None:
    """A film job ended with an error: leave the film in a state the creator can act on (never stuck "working")."""
    prod = production_of(db, job.project_id)
    if prod is None or prod.status not in ("planning", "generating", "rendering"):
        return
    for sh in db.scalars(select(FilmShot).join(FilmScene).where(FilmScene.production_id == prod.id, FilmShot.status == "generating")).all():
        sh.status = "pending"
    prod.status = {"planning": "failed", "generating": "failed", "rendering": "generated"}[prod.status]
    if job.task == "film_plan" and not prod.scenes:
        prod.status = "failed"
    prod.error = job.error or "The job stopped."
    db.commit()


# ---------- Restart recovery ----------

async def recover_interrupted() -> list[str]:
    """After a restart: film jobs left "queued"/"running" were cut off. Mark them, put half-made shots back to
    pending, and start the work again — finished scenes and shots are kept, so nothing done is made twice.
    Runs where the jobs run: the API process without Redis, the Arq worker with it."""
    from app.db import SessionLocal
    from app.services.pipeline import run_job
    restarted: list[str] = []
    with SessionLocal() as db:
        # with Redis, queued jobs are still waiting in the queue; only the ones a worker was running were lost
        lost = ("running",) if get_settings().REDIS_URL else ("queued", "running")
        stuck = db.scalars(select(AIJob).where(AIJob.task.in_(FILM_TASKS_NAMES), AIJob.status.in_(lost))).all()
        for job in stuck:
            job.status, job.error = "failed", "Interrupted by a server restart — started again automatically."
            prod = production_of(db, job.project_id)
            if prod:
                for sh in db.scalars(select(FilmShot).join(FilmScene).where(FilmScene.production_id == prod.id,
                                                                           FilmShot.status == "generating")).all():
                    sh.status = "pending"
            again = AIJob(project_id=job.project_id, user_id=job.user_id, task=job.task, params=job.params)
            db.add(again)
            db.commit()
            restarted.append(again.id)
            log.warning("film job %s (%s) was interrupted — resumed as %s", job.id, job.task, again.id)
    for job_id in restarted:
        if get_settings().REDIS_URL:
            from app.services.jobs import _enqueue_arq
            await _enqueue_arq(job_id)
        else:
            asyncio.get_running_loop().create_task(run_job(job_id))
    return restarted
