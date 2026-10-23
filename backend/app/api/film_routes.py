"""Long film API (10 minutes – 2 hours): plan, estimate, generate, progress, pause/resume, retry, render, download.

Every route checks that the film belongs to the signed-in creator. Provider keys never leave the server.
"""

from typing import Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.config import get_settings
from app.db import get_db
from app.models import AIJob, Asset, FilmProduction, FilmScene, FilmShot, Project
from app.schemas import Schema
from app.services.film_production import (FILM_TASKS_NAMES, MAX_SECONDS, MIN_SECONDS, active_film_job, estimate,
                                          production_of, progress)
from app.services.jobs import create_job
from app.services.scene_generator import reopen_scene

router = APIRouter()
BUSY = ("planning", "generating", "rendering")


class FilmCreate(Schema):
    target_minutes: float = Field(ge=MIN_SECONDS / 60, le=MAX_SECONDS / 60)
    budget_cap: float | None = Field(default=None, ge=0)
    quality: Literal["draft", "final"] = "draft"


class FilmUpdate(Schema):
    budget_cap: float | None = Field(default=None, ge=0)
    quality: Literal["draft", "final"] | None = None


class FilmGenerate(Schema):
    confirm_cost: bool = False


# ---------- helpers ----------

def _project(db: Session, project_id: str, user: CurrentUser) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _production(db: Session, project_id: str, user: CurrentUser) -> tuple[Project, FilmProduction]:
    project = _project(db, project_id, user)
    prod = production_of(db, project.id, with_shots=True)
    if prod is None:
        raise HTTPException(404, detail="This film has no full-length version yet")
    return project, prod


def _urls(db: Session, ids: list[str | None]) -> dict[str, Asset]:
    ids = [i for i in ids if i]
    return {a.id: a for a in db.scalars(select(Asset).where(Asset.id.in_(ids))).all()} if ids else {}


def _job(job: AIJob | None) -> dict | None:
    if job is None:
        return None
    return {"id": job.id, "task": job.task, "status": job.status, "stage": job.stage, "progress": job.progress,
            "error": job.error}


def _check_budget_cap(value: float | None) -> float:
    s = get_settings()
    cap = s.LONG_FILM_DEFAULT_BUDGET if value is None else value
    if cap > s.LONG_FILM_MAX_BUDGET:
        raise HTTPException(422, detail=f"The budget cap can be at most ${s.LONG_FILM_MAX_BUDGET:,.0f}")
    return cap


def _film_out(db: Session, project: Project, prod: FilmProduction) -> dict:
    scenes = list(prod.scenes)
    assets = _urls(db, [sc.preview_asset_id for sc in scenes] + [prod.final_asset_id])
    final = assets.get(prod.final_asset_id or "")
    last = db.scalars(select(AIJob).where(AIJob.project_id == project.id, AIJob.task.in_(FILM_TASKS_NAMES))
                      .order_by(AIJob.created_at.desc())).first()
    test_clips = db.scalars(select(Asset.id).where(Asset.project_id == project.id, Asset.type == "film_clip",
                                                   Asset.status == "ready", Asset.provider == "ffmpeg",
                                                   Asset.model == "test")).first() is not None
    return {
        "id": prod.id, "projectId": project.id, "status": prod.status, "error": prod.error,
        "targetSeconds": prod.target_seconds, "shotSeconds": prod.shot_seconds, "quality": prod.quality,
        "budgetCap": prod.budget_cap, "spent": round(prod.spent, 4), "pauseRequested": prod.pause_requested,
        "progress": progress(prod), "estimate": estimate(db, prod), "job": _job(active_film_job(db, project.id) or last),
        "hasTestClips": test_clips,
        "final": {"url": final.url, "seconds": final.meta.get("seconds")} if final and final.status == "ready" else None,
        "scenes": [{
            "number": sc.number, "act": sc.act, "title": sc.title, "summary": sc.summary, "location": sc.location,
            "characters": sc.characters, "targetSeconds": sc.target_seconds, "status": sc.status, "error": sc.error,
            "shots": len(sc.shots), "shotsDone": sum(sh.status == "done" for sh in sc.shots),
            "shotsFailed": sum(sh.status == "failed" for sh in sc.shots),
            "previewUrl": assets[sc.preview_asset_id].url if sc.preview_asset_id in assets else None,
        } for sc in scenes],
    }


def _scene(db: Session, prod: FilmProduction, number: int) -> FilmScene:
    sc = next((s for s in prod.scenes if s.number == number), None)
    if sc is None:
        raise HTTPException(404, detail="Scene not found")
    return sc


def _check_can_start(db: Session, project: Project, user: CurrentUser) -> None:
    """One job per film at a time, and a per-creator limit on full-length films being made at once."""
    if active_film_job(db, project.id):
        raise HTTPException(409, detail="This film is already being worked on")
    limit = get_settings().LONG_FILM_MAX_ACTIVE
    running = db.scalar(select(func.count(func.distinct(AIJob.project_id))).where(
        AIJob.user_id == user.id, AIJob.task.in_(FILM_TASKS_NAMES), AIJob.status.in_(("queued", "running"))))
    if running >= limit:
        raise HTTPException(429, detail=f"You can make {limit} full-length film(s) at a time — "
                                        "wait for the other one to finish or pause it")


def _start(db: Session, background: BackgroundTasks, project: Project, user: CurrentUser, task: str) -> AIJob:
    _check_can_start(db, project, user)
    return create_job(db, background, project_id=project.id, user_id=user.id, task=task)


# ---------- routes ----------

@router.post("/projects/{project_id}/film", status_code=202)
def create_film(project_id: str, body: FilmCreate, background: BackgroundTasks, db: Session = Depends(get_db),
                user: CurrentUser = Depends(get_current_user)):
    """Start (or re-plan) the full-length version: story bible and scene outline for the target length."""
    project = _project(db, project_id, user)
    if not (project.memory or {}).get("characters"):
        raise HTTPException(409, detail="Plan the film's story first, then make the full-length version")
    prod = production_of(db, project.id)
    if prod and prod.status in BUSY:
        raise HTTPException(409, detail="This film is already being worked on")
    cap = _check_budget_cap(body.budget_cap)
    _check_can_start(db, project, user)
    if prod is None:
        prod = FilmProduction(project_id=project.id, target_seconds=0)
        db.add(prod)
    prod.target_seconds, prod.budget_cap, prod.quality = round(body.target_minutes * 60), cap, body.quality
    prod.shot_seconds, prod.status, prod.error, prod.final_asset_id = get_settings().LONG_SHOT_SECONDS, "planning", "", None
    db.commit()
    _start(db, background, project, user, "film_plan")
    return _film_out(db, project, prod)


@router.get("/projects/{project_id}/film")
def get_film(project_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = _project(db, project_id, user)
    prod = production_of(db, project.id, with_shots=True)
    return _film_out(db, project, prod) if prod else None


@router.patch("/projects/{project_id}/film")
def update_film(project_id: str, body: FilmUpdate, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project, prod = _production(db, project_id, user)
    if body.budget_cap is not None:
        prod.budget_cap = _check_budget_cap(body.budget_cap)
        if prod.status == "budget_reached" and prod.budget_cap > prod.spent:
            prod.status, prod.error = "paused", ""
    if body.quality and prod.status not in BUSY:
        prod.quality = body.quality
    db.commit()
    return _film_out(db, project, prod)


@router.get("/projects/{project_id}/film/scenes/{number}")
def get_scene(project_id: str, number: int, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """One scene in full: script, continuity and every shot with its clip."""
    _, prod = _production(db, project_id, user)
    sc = _scene(db, prod, number)
    assets = _urls(db, [sh.video_asset_id for sh in sc.shots] + [sh.audio_asset_id for sh in sc.shots] + [sc.preview_asset_id])
    return {
        "number": sc.number, "title": sc.title, "summary": sc.summary, "location": sc.location, "script": sc.script,
        "continuity": sc.continuity, "status": sc.status, "error": sc.error,
        "previewUrl": assets[sc.preview_asset_id].url if sc.preview_asset_id in assets else None,
        "shots": [{
            "id": sh.id, "number": sh.number, "description": sh.description, "camera": sh.camera,
            "movement": sh.movement, "characters": sh.characters, "dialogue": sh.dialogue, "seconds": sh.seconds,
            "status": sh.status, "attempts": sh.attempts, "error": sh.error,
            "clipUrl": assets[sh.video_asset_id].url if sh.video_asset_id in assets else None,
            "clipKind": assets[sh.video_asset_id].meta.get("kind") if sh.video_asset_id in assets else None,
        } for sh in sc.shots],
    }


@router.post("/projects/{project_id}/film/generate", status_code=202)
def generate_film(project_id: str, body: FilmGenerate, background: BackgroundTasks, db: Session = Depends(get_db),
                  user: CurrentUser = Depends(get_current_user)):
    """Make the scenes (or continue after a pause / a budget stop). Paid work over the threshold needs confirmation."""
    project, prod = _production(db, project_id, user)
    if prod.status in BUSY:
        raise HTTPException(409, detail="This film is already being worked on")
    if not prod.scenes:
        raise HTTPException(409, detail="Plan the scenes first")
    est = estimate(db, prod)
    if est["estimatedCost"] > get_settings().COST_CONFIRM_THRESHOLD and not body.confirm_cost:
        raise HTTPException(402, detail=f"Estimated cost ${est['estimatedCost']:.2f} needs confirmation")
    if prod.spent >= prod.budget_cap and est["estimatedCost"] > 0:
        raise HTTPException(402, detail=f"The budget cap (${prod.budget_cap:.2f}) is used up — raise it to continue")
    _check_can_start(db, project, user)
    prod.pause_requested = False
    db.commit()
    _start(db, background, project, user, "film_generate")
    return _film_out(db, project, prod)


@router.post("/projects/{project_id}/film/pause")
def pause_film(project_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Stop after the shot that's being made now (nothing finished is lost)."""
    project, prod = _production(db, project_id, user)
    if prod.status != "generating":
        raise HTTPException(409, detail="Nothing is being generated")
    prod.pause_requested = True
    db.commit()
    return _film_out(db, project, prod)


@router.post("/projects/{project_id}/film/resume", status_code=202)
def resume_film(project_id: str, body: FilmGenerate, background: BackgroundTasks, db: Session = Depends(get_db),
                user: CurrentUser = Depends(get_current_user)):
    return generate_film(project_id, body, background, db, user)


def _reset_shot(sh: FilmShot) -> None:
    sh.status, sh.attempts, sh.error = "pending", 0, ""


def _reopen_scene(prod: FilmProduction, sc: FilmScene) -> None:
    reopen_scene(prod, sc)


# ---------- Editing a scene ----------

class DialogueLine(Schema):
    character: str = Field(default="", max_length=120)
    text: str = Field(max_length=2000)


class ShotEdit(Schema):
    id: str
    description: str | None = Field(default=None, max_length=2000)
    camera: str | None = Field(default=None, max_length=100)
    movement: str | None = Field(default=None, max_length=100)
    dialogue: list[DialogueLine] | None = Field(default=None, max_length=8)


class SceneEdit(Schema):
    title: str | None = Field(default=None, max_length=300)
    summary: str | None = Field(default=None, max_length=5000)
    location: str | None = Field(default=None, max_length=300)
    script: str | None = Field(default=None, max_length=50000)
    shots: list[ShotEdit] | None = None


class SceneRewrite(Schema):
    instruction: str = Field(min_length=1, max_length=2000)


def _editable(db: Session, project_id: str, number: int, user: CurrentUser) -> tuple[Project, FilmProduction, FilmScene]:
    project, prod = _production(db, project_id, user)
    if prod.status in BUSY or active_film_job(db, project.id):
        raise HTTPException(409, detail="Pause the film (or wait for the current work to finish), then edit")
    return project, prod, _scene(db, prod, number)


@router.patch("/projects/{project_id}/film/scenes/{number}")
def edit_scene(project_id: str, number: int, body: SceneEdit, db: Session = Depends(get_db),
               user: CurrentUser = Depends(get_current_user)):
    """Hand edits to a scene. Shots whose picture or words changed are made again; the rest are kept."""
    project, prod, sc = _editable(db, project_id, number, user)
    for field in ("title", "summary", "location", "script"):
        value = getattr(body, field)
        if value is not None:
            setattr(sc, field, value.strip())
    shots = {sh.id: sh for sh in sc.shots}
    changed = 0
    for edit in body.shots or []:
        sh = shots.get(edit.id)
        if sh is None:
            raise HTTPException(404, detail="Shot not found in this scene")
        new = {"description": edit.description, "camera": edit.camera, "movement": edit.movement,
               "dialogue": [d.model_dump() for d in edit.dialogue if d.text.strip()] if edit.dialogue is not None else None}
        diff = {k: v for k, v in new.items() if v is not None and v != getattr(sh, k)}
        if diff:
            for k, v in diff.items():
                setattr(sh, k, v)
            if sh.status != "pending" or sh.video_asset_id:
                _reset_shot(sh)
                sh.video_asset_id = sh.audio_asset_id = sh.frame_asset_id = None
            changed += 1
    if changed:  # title, summary and script are the scene's text; the shots are what gets filmed
        reopen_scene(prod, sc)
    db.commit()
    return get_scene(project_id, number, db, user)


@router.post("/projects/{project_id}/film/scenes/{number}/rewrite", status_code=202)
def rewrite_scene(project_id: str, number: int, body: SceneRewrite, background: BackgroundTasks,
                  db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    """Direct the AI: it rewrites this scene's script and shots; only this scene is made again."""
    project, prod, sc = _editable(db, project_id, number, user)
    _check_can_start(db, project, user)
    job = create_job(db, background, project_id=project.id, user_id=user.id, task="film_rewrite_scene",
                     params={"scene": sc.number, "instruction": body.instruction.strip()})
    return _job(job)


@router.post("/projects/{project_id}/film/shots/{shot_id}/retry", status_code=202)
def retry_shot(project_id: str, shot_id: str, background: BackgroundTasks, db: Session = Depends(get_db),
               user: CurrentUser = Depends(get_current_user)):
    """Make one shot again (only that shot is redone; its scene file is joined again afterwards)."""
    project, prod = _production(db, project_id, user)
    sh = db.get(FilmShot, shot_id)
    if sh is None or sh.scene.production_id != prod.id:
        raise HTTPException(404, detail="Shot not found")
    if prod.status in BUSY:
        raise HTTPException(409, detail="Wait for the current work to finish (or pause it), then retry")
    _reset_shot(sh)
    _reopen_scene(prod, sh.scene)
    db.commit()
    return generate_film(project_id, FilmGenerate(confirm_cost=True), background, db, user)


@router.post("/projects/{project_id}/film/scenes/{number}/retry", status_code=202)
def retry_scene(project_id: str, number: int, background: BackgroundTasks, db: Session = Depends(get_db),
                user: CurrentUser = Depends(get_current_user)):
    """Retry a scene's failed shots (or, if its script failed, write it again)."""
    project, prod = _production(db, project_id, user)
    if prod.status in BUSY:
        raise HTTPException(409, detail="Wait for the current work to finish (or pause it), then retry")
    sc = _scene(db, prod, number)
    for sh in sc.shots:
        if sh.status != "done":
            _reset_shot(sh)
    _reopen_scene(prod, sc)
    db.commit()
    return generate_film(project_id, FilmGenerate(confirm_cost=True), background, db, user)


@router.post("/projects/{project_id}/film/render", status_code=202)
def render_film(project_id: str, background: BackgroundTasks, db: Session = Depends(get_db),
                user: CurrentUser = Depends(get_current_user)):
    project, prod = _production(db, project_id, user)
    if prod.status in BUSY:
        raise HTTPException(409, detail="This film is already being worked on")
    if not prod.scenes or any(sc.status != "done" for sc in prod.scenes):
        raise HTTPException(409, detail="Generate every scene before rendering the film")
    _start(db, background, project, user, "film_render")
    return _film_out(db, project, prod)


@router.get("/projects/{project_id}/film/download")
def download_film(project_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    _, prod = _production(db, project_id, user)
    final = db.get(Asset, prod.final_asset_id) if prod.final_asset_id else None
    if final is None or final.status != "ready":
        raise HTTPException(404, detail="The film hasn't been rendered yet")
    return RedirectResponse(final.url, status_code=307)
