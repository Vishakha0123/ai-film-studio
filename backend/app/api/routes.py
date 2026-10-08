"""REST API (report section 28). Every route checks that the project belongs to the caller."""

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import CurrentUser, get_current_user
from app.config import Settings, get_settings
from app.db import get_db
from app.models import AIJob, Asset, Project, ProjectDocument, User, WorkflowStep
from app.schemas import (ApproveRequest, AssetListItem, AssetOut, Brief, CostEstimate, DocumentOut, EditRequest, FilmProject, Transcript,
                         GenerateRequest, JobOut, Me, PlanRequest, Preferences, ProjectCreate, ProjectOut, ProjectSummary,
                         ProjectUpdate, RenderRequest)
from app.providers import ProviderError, stt_provider
from app.services import storage
from app.services.documents import MAX_FILES_PER_PROJECT, DocumentError, validate_and_extract
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


def _me(db: Session, user: CurrentUser) -> Me:
    row = db.get(User, user.id)
    prefs = Preferences.model_validate((row.profile or {}).get("preferences", {})) if row else Preferences()
    return Me(id=user.id, email=user.email, preferences=prefs)


@router.get("/me", response_model=Me)
def me(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    return _me(db, user)


@router.patch("/me", response_model=Me)
def update_me(body: Preferences, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    row = db.get(User, user.id)
    row.profile = {**(row.profile or {}), "preferences": body.model_dump(by_alias=True)}
    db.commit()
    return _me(db, user)


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


def _summary(p: Project) -> ProjectSummary:
    ready = [a for a in p.assets if a.status in ("ready", "outdated")]
    frames = sorted((a for a in ready if a.type == "storyboard_image"), key=lambda a: (a.ref, -a.version))
    return ProjectSummary(id=p.id, title=p.title, genre=p.genre, status=p.status,
                          logline=(p.memory or {}).get("logline", ""), thumbnail_url=frames[0].url if frames else None,
                          asset_count=len(ready), created_at=p.created_at, updated_at=p.updated_at)


@router.get("/projects", response_model=list[ProjectSummary])
def list_projects(db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    rows = db.scalars(select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc())).all()
    return [_summary(p) for p in rows]


@router.patch("/projects/{project_id}", response_model=ProjectOut)
def rename_project(project_id: str, body: ProjectUpdate, db: Session = Depends(get_db),
                   user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    project.title = body.title.strip()
    if project.memory:
        project.memory = {**project.memory, "title": project.title}
    db.commit()
    db.refresh(project)
    return _project_out(project)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    db.query(AIJob).filter(AIJob.project_id == project.id).delete()
    db.query(WorkflowStep).filter(WorkflowStep.project_id == project.id).delete()
    db.query(ProjectDocument).filter(ProjectDocument.project_id == project.id).delete()
    db.delete(project)  # assets cascade
    db.commit()


@router.get("/assets", response_model=list[AssetListItem])
def list_assets(project_id: str | None = None, type: str | None = None, db: Session = Depends(get_db),
                user: CurrentUser = Depends(get_current_user)):
    q = (select(Asset, Project.title).join(Project, Asset.project_id == Project.id)
         .where(Project.user_id == user.id, Asset.status.in_(("ready", "outdated"))))
    if project_id:
        q = q.where(Asset.project_id == project_id)
    if type:
        q = q.where(Asset.type == type)
    rows = db.execute(q.order_by(Asset.created_at.desc())).all()
    return [AssetListItem(**AssetOut.model_validate(a).model_dump(), project_id=a.project_id, project_title=title,
                          created_at=a.created_at) for a, title in rows]


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


# ---------- Attached source material (report section 20) ----------

def _doc_out(d: ProjectDocument) -> DocumentOut:
    return DocumentOut(id=d.id, filename=d.filename, type=d.type, size=d.size, file_url=d.file_url,
                       source_reference=d.source_reference, preview=d.extracted_text[:280], created_at=d.created_at)


@router.post("/projects/{project_id}/documents", response_model=DocumentOut, status_code=201)
async def upload_document(project_id: str, file: UploadFile = File(...), db: Session = Depends(get_db),
                          user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    count = db.scalar(select(func.count()).select_from(ProjectDocument).where(ProjectDocument.project_id == project.id)) or 0
    if count >= MAX_FILES_PER_PROJECT:
        raise HTTPException(409, detail=f"A project can have up to {MAX_FILES_PER_PROJECT} attached files")
    data = await file.read(10 * 1024 * 1024 + 1)
    name = (file.filename or "attachment").replace("/", "_").replace("\\", "_")[-200:]
    try:
        kind, text, ref = validate_and_extract(name, data)
    except DocumentError as e:
        raise HTTPException(422, detail=str(e))
    doc = ProjectDocument(project_id=project.id, filename=name, type=kind, content_type=file.content_type or "",
                          size=len(data), extracted_text=text, source_reference=ref)
    db.add(doc)
    db.flush()
    doc.file_url = await storage.save_bytes(f"projects/{project.id}/documents/{doc.id}-{name}", data, file.content_type)
    db.commit()
    return _doc_out(doc)


@router.get("/projects/{project_id}/documents", response_model=list[DocumentOut])
def list_documents(project_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    project = _own_project(db, project_id, user)
    rows = db.scalars(select(ProjectDocument).where(ProjectDocument.project_id == project.id)
                      .order_by(ProjectDocument.created_at)).all()
    return [_doc_out(d) for d in rows]


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db), user: CurrentUser = Depends(get_current_user)):
    doc = db.get(ProjectDocument, document_id)
    if doc is None:
        raise HTTPException(404, detail="Document not found")
    _own_project(db, doc.project_id, user)
    db.delete(doc)
    db.commit()


# ---------- Voice input ----------

@router.post("/transcribe", response_model=Transcript)
async def transcribe(audio: UploadFile = File(...), language: str = Form("en"),
                     user: CurrentUser = Depends(get_current_user), settings: Settings = Depends(get_settings)):
    if settings.STT_PROVIDER == "mock":
        raise HTTPException(501, detail="Voice transcription isn't connected on the server (STT_PROVIDER=mock)")
    data = await audio.read(10 * 1024 * 1024 + 1)
    if not data or len(data) > 10 * 1024 * 1024:
        raise HTTPException(422, detail="Recordings can be up to 10 MB (about 30 seconds works best)")
    try:
        res = await stt_provider().transcribe(data, filename=audio.filename or "voice.webm", language=language)
    except ProviderError as e:
        raise HTTPException(502, detail=f"Transcription failed: {e}")
    return Transcript(text=res.data, provider=res.provider)
