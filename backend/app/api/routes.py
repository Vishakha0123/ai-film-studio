"""REST API (report section 28). Every route checks that the project belongs to the caller."""

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.models import AIJob, Asset, Project, WorkflowStep
from app.schemas import (ApproveRequest, AssetOut, Brief, CostEstimate, EditRequest, FilmProject, GenerateRequest,
                         JobOut, Me, PlanRequest, ProjectCreate, ProjectOut, ProjectSummary, RenderRequest)
from app.services.jobs import create_job
from app.services.pipeline import estimate

router = APIRouter()


def _own_project(db: Session, project_id: str, user: CurrentUser) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:  # same 404 either way: don't leak existence
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _memory_with_assets(project: Project) -> dict | None:
    """Project memory with the latest ready asset URLs filled in (imageUrl, videoUrl, audio url)."""
    if not project.memory:
        return None
    mem = dict(project.memory)
    latest: dict[tuple[str, str], Asset] = {}
    for a in project.assets:
        if a.status != "ready":
            continue
        key = (a.type, a.ref)
        if key not in latest or a.version > latest[key].version:
            latest[key] = a
    mem["characters"] = [{**c, **({"imageUrl": latest[("character_image", c["id"])].url} if ("character_image", c["id"]) in latest else {})}
                         for c in mem.get("characters", [])]
    shots = []
    for s in mem.get("shots", []):
        ref = str(s["number"])
        extra = {}
        if ("storyboard_image", ref) in latest:
            extra["imageUrl"] = latest[("storyboard_image", ref)].url
        if ("video_clip", ref) in latest:
            extra["videoUrl"] = latest[("video_clip", ref)].url
        shots.append({**s, **extra})
    mem["shots"] = shots
    return mem


def _project_out(project: Project) -> ProjectOut:
    mem = _memory_with_assets(project)
    return ProjectOut(
        id=project.id, title=project.title, genre=project.genre, language=project.language, status=project.status,
        brief=project.brief or {}, memory=FilmProject.model_validate(mem) if mem else None,
        assets=[AssetOut.model_validate(a) for a in project.assets if a.status in ("ready", "outdated")],
        created_at=project.created_at, updated_at=project.updated_at,
    )


@router.get("/me", response_model=Me)
def me(user: CurrentUser = Depends(get_current_user)):
    return Me(id=user.id, email=user.email)


@router.post("/projects", response_model=ProjectOut, status_code=201)
def create_project(body: ProjectCreate, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user),
                   settings: Settings = Depends(get_settings)):
    count = db.scalar(select(func.count()).select_from(Project).where(Project.user_id == user.id)) or 0
    if count >= settings.MAX_PROJECTS_PER_USER:
        raise HTTPException(429, detail="Project limit reached")
    project = Project(user_id=user.id, title=body.title or "Untitled Film", genre=" / ".join(body.genres),
                      language=body.language, brief={"genres": body.genres, "language": body.language})
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    rows = db.scalars(select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc())).all()
    return [ProjectSummary.model_validate(p) for p in rows]


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _project_out(_own_project(db, project_id, user))


@router.post("/projects/{project_id}/brief", response_model=ProjectOut)
def update_brief(project_id: str, body: Brief, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    project.brief = body.model_dump(by_alias=True)
    project.language = body.language
    if body.genres:
        project.genre = " / ".join(body.genres)
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.post("/projects/{project_id}/plan", response_model=JobOut, status_code=202)
def plan(project_id: str, body: PlanRequest, background: BackgroundTasks, db: Session = Depends(get_db),
         user: CurrentUser = Depends(get_current_user), idempotency_key: str | None = Header(default=None)):
    project = _own_project(db, project_id, user)
    return create_job(db, background, project_id=project.id, user_id=user.id, task="plan",
                      params=body.model_dump(exclude_none=True), idempotency_key=idempotency_key)


def _edit(action: str):
    def handler(project_id: str, body: EditRequest, background: BackgroundTasks, db: Session = Depends(get_db),
                user: CurrentUser = Depends(get_current_user), idempotency_key: str | None = Header(default=None)):
        project = _own_project(db, project_id, user)
        instruction = body.instruction or {"continue": "Continue it naturally.", "complete": "Fill in anything missing.",
                                           "improve": "Improve the writing, emotion and pacing."}.get(action, "")
        return create_job(db, background, project_id=project.id, user_id=user.id, task="edit",
                          params={"target": body.target, "instruction": instruction, "action": action},
                          idempotency_key=idempotency_key)
    handler.__name__ = f"edit_{action}"
    return handler


for _action in ("continue", "complete", "improve", "transform"):
    router.add_api_route(f"/projects/{{project_id}}/{_action}", _edit(_action), methods=["POST"],
                         response_model=JobOut, status_code=202)


@router.post("/projects/{project_id}/approve")
def approve(project_id: str, body: ApproveRequest, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    prev = db.scalar(select(func.max(WorkflowStep.version)).where(WorkflowStep.project_id == project.id,
                                                                    WorkflowStep.step_type == body.step)) or 0
    step = WorkflowStep(project_id=project.id, step_type=body.step, status="approved" if body.approved else "rejected",
                        note=body.note, version=prev + 1)
    db.add(step)
    db.commit()
    return {"step": step.step_type, "status": step.status, "version": step.version}


@router.get("/projects/{project_id}/estimate", response_model=CostEstimate)
def cost_estimate(project_id: str, quality: str = "draft", db: Session = Depends(get_db),
                  user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    return CostEstimate.model_validate(estimate(project.memory or {}, "final" if quality == "final" else "draft"))


@router.post("/projects/{project_id}/generate", response_model=JobOut, status_code=202)
def generate(project_id: str, body: GenerateRequest, background: BackgroundTasks, db: Session = Depends(get_db),
             user: CurrentUser = Depends(get_current_user), idempotency_key: str | None = Header(default=None)):
    project = _own_project(db, project_id, user)
    if not (project.memory or {}).get("shots"):
        raise HTTPException(409, detail="Plan the film before generating the teaser")
    est = estimate(project.memory, body.quality)
    if est["requiresConfirmation"] and not body.confirm_cost:
        raise HTTPException(402, detail=f"Estimated cost ${est['estimatedCost']:.2f} needs confirmation")
    return create_job(db, background, project_id=project.id, user_id=user.id, task="generate",
                      params={"quality": body.quality}, idempotency_key=idempotency_key)


@router.post("/projects/{project_id}/render", response_model=JobOut, status_code=202)
def render(project_id: str, body: RenderRequest, background: BackgroundTasks, db: Session = Depends(get_db),
           user: CurrentUser = Depends(get_current_user), idempotency_key: str | None = Header(default=None)):
    project = _own_project(db, project_id, user)
    return create_job(db, background, project_id=project.id, user_id=user.id, task="render",
                      params=body.model_dump(by_alias=True), idempotency_key=idempotency_key)


@router.post("/assets/{asset_id}/regenerate", response_model=JobOut, status_code=202)
def regenerate(asset_id: str, background: BackgroundTasks, db: Session = Depends(get_db),
               user: CurrentUser = Depends(get_current_user)):
    asset = db.get(Asset, asset_id)
    if asset is None:
        raise HTTPException(404, detail="Asset not found")
    project = _own_project(db, asset.project_id, user)
    return create_job(db, background, project_id=project.id, user_id=user.id, task="regenerate",
                      params={"asset_id": asset.id})


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    job = db.get(AIJob, job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(404, detail="Job not found")
    return job


@router.post("/jobs/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    job = db.get(AIJob, job_id)
    if job is None or job.user_id != user.id:
        raise HTTPException(404, detail="Job not found")
    if job.status in ("queued", "running"):
        job.status = "cancelled"
        db.commit()
    return job


@router.post("/webhooks/providers/{provider}", status_code=202)
def provider_webhook(provider: str):
    """Reserved for provider completion callbacks. Jobs currently poll providers directly."""
    return {"received": provider}
