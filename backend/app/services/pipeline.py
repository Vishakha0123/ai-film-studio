"""Generation pipeline: the work behind every AI job.

Each job task runs here, either in-process (local dev) or on the Arq worker (REDIS_URL set).
Implements the report's rules: retry transient provider failures once, never duplicate paid
work (ready assets are reused), track usage/cost, mark downstream assets outdated, and finish
with `needs_review` + an explanation when no safe result is possible.
"""

import asyncio
import logging
import shutil
import subprocess
import tempfile
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TypeVar

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import AIJob, Asset, Project, ProjectDocument, UsageEvent
from app.providers import ProviderError, image_provider, story_provider, tts_provider, video_provider
from app.providers.base import ProviderResult
from app.schemas import FilmProject
from app.services import storage

log = logging.getLogger("cineai.pipeline")
T = TypeVar("T")

ASPECT_SIZES = {"16:9": "1536x1024", "9:16": "1024x1536", "1:1": "1024x1024"}
VISUAL_STYLE = "cinematic film still, dark cinema look, desaturated palette with warm amber practical light, 35mm, shallow depth of field"


class NeedsReview(Exception):
    """Stop the job and ask the creator to review (no safe automatic fallback)."""


# ---------------------------------------------------------------- helpers

def _seconds(duration: str, default: float = 2.5) -> float:
    try:
        return float(str(duration).rstrip("s").strip())
    except ValueError:
        return default


def validate_film(data: object) -> dict:
    """Validate provider output against the FilmProject schema and normalise ids."""
    film = FilmProject.model_validate(data)
    for i, c in enumerate(film.characters, 1):
        c.id = c.id or str(i)
    for i, s in enumerate(film.scenes, 1):
        s.id, s.number = s.id or str(i), s.number or i
    for i, s in enumerate(film.shots, 1):
        s.id, s.number = s.id or str(i), s.number or i
    return film.model_dump(by_alias=True, exclude_none=True)


async def with_retry(fn: Callable[[], Awaitable[T]], job: AIJob, db: Session) -> T:
    """Retry a transient provider failure once (report section 30)."""
    try:
        return await fn()
    except ProviderError as e:
        if not e.transient:
            raise
        job.retry_count += 1
        db.commit()
        log.warning("transient provider error, retrying once: %s", e)
        await asyncio.sleep(2)
        return await fn()


def record_usage(db: Session, job: AIJob, res: ProviderResult) -> None:
    job.cost = round(job.cost + res.cost, 4)
    db.add(UsageEvent(user_id=job.user_id, project_id=job.project_id, provider=res.provider,
                      model=res.model, usage=res.usage or {}, cost=res.cost))
    db.commit()


def set_progress(db: Session, job: AIJob, stage: str, progress: int) -> None:
    job.stage, job.progress = stage, max(job.progress, min(progress, 99))
    db.commit()


def latest_asset(db: Session, project_id: str, type_: str, ref: str) -> Asset | None:
    return db.scalars(
        select(Asset).where(Asset.project_id == project_id, Asset.type == type_, Asset.ref == ref)
        .order_by(Asset.version.desc())
    ).first()


def mark_outdated(db: Session, project_id: str, types: list[str], refs: list[str] | None = None) -> int:
    q = select(Asset).where(Asset.project_id == project_id, Asset.type.in_(types), Asset.status == "ready")
    if refs is not None:
        q = q.where(Asset.ref.in_(refs))
    rows = db.scalars(q).all()
    for a in rows:
        a.status = "outdated"
    db.commit()
    return len(rows)


async def store_asset(db: Session, project: Project, type_: str, ref: str, res: ProviderResult,
                      data: bytes | None = None, ext: str = "png", url: str | None = None,
                      meta: dict | None = None, dependencies: list | None = None) -> Asset:
    prev = latest_asset(db, project.id, type_, ref)
    version = (prev.version + 1) if prev else 1
    if data is not None:
        url = await storage.save_bytes(f"projects/{project.id}/{type_}/{ref}-v{version}.{ext}", data)
    asset = Asset(project_id=project.id, type=type_, ref=ref, url=url or "", provider=res.provider,
                  model=res.model, version=version, status="ready", meta=meta or {}, dependencies=dependencies or [])
    if prev and prev.status == "ready":
        prev.status = "superseded"
    db.add(asset)
    db.commit()
    return asset


def _image_ext(data: bytes) -> str:
    return "svg" if data.lstrip()[:4] in (b"<svg", b"<?xm") else "png"


# ---------------------------------------------------------------- tasks

async def task_plan(db: Session, job: AIJob, project: Project) -> dict:
    set_progress(db, job, "Understanding the brief", 10)
    brief = dict(project.brief or {})
    if job.params.get("prompt"):
        brief["prompt"] = job.params["prompt"]
    docs = db.scalars(select(ProjectDocument).where(ProjectDocument.project_id == project.id)
                      .order_by(ProjectDocument.created_at)).all()
    if docs:
        from app.services.documents import source_material
        brief["sourceMaterial"] = source_material(docs)
        brief.setdefault("prompt", "Turn the attached source material into a teaser.")
    if not brief.get("prompt"):
        raise NeedsReview("Add a film idea to the brief before planning.")
    res = await with_retry(lambda: story_provider().plan_film(brief), job, db)
    record_usage(db, job, res)
    set_progress(db, job, "Writing story, characters and screenplay", 70)
    try:
        memory = validate_film(res.data)
    except ValidationError as e:
        raise NeedsReview(f"The story model returned an incomplete plan ({e.error_count()} problems). Try again.") from e
    project.memory = memory
    project.title = memory["title"][:300]
    project.genre = memory.get("genre", project.genre)[:200]
    project.status = "planned"
    mark_outdated(db, project.id, ["character_image", "storyboard_image", "video_clip", "voice", "render"])
    db.commit()
    return {"title": project.title}


EDIT_DEPENDENTS = {
    "characters": ["character_image", "storyboard_image", "video_clip", "render"],
    "shots": ["storyboard_image", "video_clip", "render"],
    "dialogue": ["voice", "render"],
    "story": [], "logline": [], "screenplay": [], "scenes": [],
}


async def task_edit(db: Session, job: AIJob, project: Project) -> dict:
    target, instruction = job.params["target"], job.params.get("instruction", "")
    if not project.memory:
        raise NeedsReview("Plan the film before editing it.")
    set_progress(db, job, f"Revising {target}", 30)
    res = await with_retry(lambda: story_provider().edit(project.memory, target, instruction), job, db)
    record_usage(db, job, res)
    memory = dict(project.memory)
    memory[target] = res.data
    try:
        project.memory = validate_film(memory)
    except ValidationError as e:
        raise NeedsReview(f"The revision didn't match the {target} format. Try rephrasing the instruction.") from e
    outdated = mark_outdated(db, project.id, EDIT_DEPENDENTS.get(target, []))
    db.commit()
    return {"target": target, "outdatedAssets": outdated}


def estimate(memory: dict, quality: str) -> dict:
    s = get_settings()
    images = len(memory.get("characters", [])) + len(memory.get("shots", []))
    video_seconds = sum(_seconds(sh.get("duration", "2.5s")) for sh in memory.get("shots", []))
    lines = len(memory.get("dialogue", []))
    rate = s.COST_PER_VIDEO_SECOND_FINAL if quality == "final" else s.COST_PER_VIDEO_SECOND_DRAFT
    cost = images * s.COST_PER_IMAGE + video_seconds * rate + lines * s.COST_PER_TTS_LINE
    return {"quality": quality, "images": images, "videoSeconds": round(video_seconds, 1), "voiceLines": lines,
            "estimatedCost": round(cost, 2), "currency": "USD", "requiresConfirmation": cost > s.COST_CONFIRM_THRESHOLD}


async def _character_image(db, job, project, char: dict, size: str) -> Asset:
    prompt = f"Character portrait of {char['name']}, {char.get('age', '')} years old, {char.get('role', '')}. {char.get('appearance', '')}. {VISUAL_STYLE}"
    res = await with_retry(lambda: image_provider().generate_image(prompt, size="1024x1024"), job, db)
    record_usage(db, job, res)
    return await store_asset(db, project, "character_image", char["id"], res, data=res.data, ext=_image_ext(res.data),
                             meta={"prompt": prompt, "name": char["name"]})


async def _storyboard_image(db, job, project, shot: dict, size: str) -> Asset:
    memory = project.memory
    names = [n.strip() for n in str(shot.get("characters", "")).split(",") if n.strip() and n.strip() != "None"]
    chars = [c for c in memory.get("characters", []) if any(n.split()[0] in c["name"] for n in names)]
    refs, deps = [], []
    for c in chars:  # reuse locked character references for consistency
        a = latest_asset(db, project.id, "character_image", c["id"])
        if a and a.status == "ready":
            deps.append(a.id)
            if a.url.endswith(".png"):
                refs.append(await storage.download(a.url))
    looks = "; ".join(f"{c['name']}: {c.get('appearance', '')}" for c in chars)
    prompt = f"Storyboard frame, shot {shot['number']}: {shot.get('camera', '')} shot, {shot.get('movement', '')}. {shot.get('description', '')} Mood: {shot.get('mood', '')}. {looks}. {VISUAL_STYLE}"
    res = await with_retry(lambda: image_provider().generate_image(prompt, size=size, references=refs or None), job, db)
    record_usage(db, job, res)
    return await store_asset(db, project, "storyboard_image", str(shot["number"]), res, data=res.data,
                             ext=_image_ext(res.data), meta={"prompt": prompt}, dependencies=deps)


async def _video_clip(db, job, project, shot: dict, frame: Asset, quality: str, aspect: str) -> Asset | None:
    prompt = f"{shot.get('movement', '')}. {shot.get('description', '')} Mood: {shot.get('mood', '')}. Cinematic, subtle motion."
    duration = max(2, round(_seconds(shot.get("duration", "2.5s"))))
    res = await with_retry(lambda: video_provider().generate_video(prompt, image_url=frame.url, duration=duration,
                                                                  quality=quality, aspect_ratio=aspect), job, db)
    record_usage(db, job, res)
    if res.data is None:
        return None
    data = await storage.download(res.data)  # keep our own copy; provider URLs expire
    return await store_asset(db, project, "video_clip", str(shot["number"]), res, data=data, ext="mp4",
                             meta={"quality": quality, "prompt": prompt}, dependencies=[frame.id])


async def _voice(db, job, project, i: int, line: dict) -> Asset:
    res = await with_retry(lambda: tts_provider().generate_voice(line["text"], language=project.language), job, db)
    record_usage(db, job, res)
    return await store_asset(db, project, "voice", str(i), res, data=res.data, ext="wav",
                             meta={"character": line.get("character"), "text": line["text"]})


def _ready(a: Asset | None, quality: str | None = None) -> bool:
    return bool(a and a.status == "ready" and (quality is None or a.meta.get("quality") in (quality, "final")))


async def task_generate(db: Session, job: AIJob, project: Project) -> dict:
    memory = project.memory or {}
    if not memory.get("shots"):
        raise NeedsReview("Plan the film (story, characters and shots) before generating the teaser.")
    quality = job.params.get("quality", "draft")
    aspect = (project.brief or {}).get("aspectRatio", "16:9")
    size = ASPECT_SIZES.get(aspect, "1536x1024")
    chars, shots, lines = memory.get("characters", []), memory.get("shots", []), memory.get("dialogue", [])
    total = max(1, len(chars) + 2 * len(shots) + len(lines))
    done = 0

    def tick(stage: str) -> None:
        set_progress(db, job, stage, 5 + int(90 * done / total))

    created = 0
    for c in chars:
        tick(f"Designing {c['name']}")
        if not _ready(latest_asset(db, project.id, "character_image", c["id"])):
            await _character_image(db, job, project, c, size); created += 1
        done += 1
    frames: dict[int, Asset] = {}
    for sh in shots:
        tick(f"Storyboarding shot {sh['number']}")
        frame = latest_asset(db, project.id, "storyboard_image", str(sh["number"]))
        if not _ready(frame):
            frame = await _storyboard_image(db, job, project, sh, size); created += 1
        frames[sh["number"]] = frame
        done += 1
    videos = 0
    for sh in shots:
        tick(f"Generating video for shot {sh['number']}")
        clip = latest_asset(db, project.id, "video_clip", str(sh["number"]))
        if not _ready(clip, quality):
            clip = await _video_clip(db, job, project, sh, frames[sh["number"]], quality, aspect)
            if clip:
                created += 1
        videos += 1 if clip else 0
        done += 1
    for i, line in enumerate(lines, 1):
        tick("Creating voice")
        if not _ready(latest_asset(db, project.id, "voice", str(i))):
            await _voice(db, job, project, i, line); created += 1
        done += 1
    project.status = "generated"
    db.commit()
    return {"createdAssets": created, "videoClips": videos, "quality": quality}


async def task_regenerate(db: Session, job: AIJob, project: Project) -> dict:
    asset = db.get(Asset, job.params["asset_id"])
    if not asset or asset.project_id != project.id:
        raise NeedsReview("That asset no longer exists.")
    memory = project.memory or {}
    size = ASPECT_SIZES.get((project.brief or {}).get("aspectRatio", "16:9"), "1536x1024")
    set_progress(db, job, f"Regenerating {asset.type.replace('_', ' ')}", 20)
    if asset.type == "character_image":
        char = next(c for c in memory["characters"] if c["id"] == asset.ref)
        new = await _character_image(db, job, project, char, size)
        # downstream frames featuring this character are now outdated
        stale = [str(s["number"]) for s in memory["shots"] if char["name"].split()[0] in str(s.get("characters", ""))]
        mark_outdated(db, project.id, ["storyboard_image", "video_clip"], stale)
    elif asset.type == "storyboard_image":
        shot = next(s for s in memory["shots"] if str(s["number"]) == asset.ref)
        new = await _storyboard_image(db, job, project, shot, size)
        mark_outdated(db, project.id, ["video_clip"], [asset.ref])
    elif asset.type == "video_clip":
        shot = next(s for s in memory["shots"] if str(s["number"]) == asset.ref)
        frame = latest_asset(db, project.id, "storyboard_image", asset.ref)
        new = await _video_clip(db, job, project, shot, frame, asset.meta.get("quality", "draft"),
                                (project.brief or {}).get("aspectRatio", "16:9"))
        if new is None:
            raise NeedsReview("The video provider is not connected, so clips can't be regenerated yet.")
    elif asset.type == "voice":
        line = memory["dialogue"][int(asset.ref) - 1]
        new = await _voice(db, job, project, int(asset.ref), line)
    else:
        raise NeedsReview(f"{asset.type} assets can't be regenerated individually.")
    mark_outdated(db, project.id, ["render"])
    return {"assetId": new.id, "version": new.version}


RENDER_SIZES = {
    ("16:9", "720"): (1280, 720), ("16:9", "1080"): (1920, 1080), ("16:9", "4k"): (3840, 2160),
    ("9:16", "720"): (720, 1280), ("9:16", "1080"): (1080, 1920), ("9:16", "4k"): (2160, 3840),
    ("1:1", "720"): (720, 720), ("1:1", "1080"): (1080, 1080), ("1:1", "4k"): (2160, 2160),
}


async def task_render(db: Session, job: AIJob, project: Project) -> dict:
    shots = (project.memory or {}).get("shots", [])
    clips = [latest_asset(db, project.id, "video_clip", str(s["number"])) for s in shots]
    if not shots or not all(c and c.status == "ready" for c in clips):
        raise NeedsReview("Every shot needs a ready video clip before rendering. Connect a video provider and generate the teaser first.")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise NeedsReview("FFmpeg is not installed on the render worker.")
    fmt, quality = job.params.get("format", "16:9"), job.params.get("quality", "1080")
    w, h = RENDER_SIZES[(fmt, quality)]
    set_progress(db, job, "Assembling teaser", 20)
    with tempfile.TemporaryDirectory() as tmp:
        parts = []
        for i, clip in enumerate(clips):
            src = Path(tmp) / f"in{i}.mp4"
            src.write_bytes(await storage.download(clip.url))
            out = Path(tmp) / f"part{i}.mp4"
            vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,fps=24"
            await asyncio.to_thread(subprocess.run, [ffmpeg, "-y", "-loglevel", "error", "-i", str(src), "-vf", vf, "-an",
                                                     "-c:v", "libx264", "-pix_fmt", "yuv420p", str(out)], check=True)
            parts.append(out)
            set_progress(db, job, "Assembling teaser", 20 + int(60 * (i + 1) / len(clips)))
        listing = Path(tmp) / "list.txt"
        listing.write_text("".join(f"file '{p}'\n" for p in parts))
        final = Path(tmp) / "teaser.mp4"
        await asyncio.to_thread(subprocess.run, [ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0",
                                                 "-i", str(listing), "-c", "copy", "-movflags", "+faststart", str(final)], check=True)
        res = ProviderResult(None, provider="ffmpeg", model="concat")
        asset = await store_asset(db, project, "render", f"{fmt}-{quality}", res, data=final.read_bytes(), ext="mp4",
                                  meta={"format": fmt, "quality": quality}, dependencies=[c.id for c in clips])
    project.status = "rendered"
    db.commit()
    return {"outputUrl": asset.url, "assetId": asset.id}


TASKS = {"plan": task_plan, "edit": task_edit, "generate": task_generate, "regenerate": task_regenerate, "render": task_render}


async def run_job(job_id: str) -> None:
    """Execute one job to completion and record its outcome."""
    db = SessionLocal()
    try:
        job = db.get(AIJob, job_id)
        if job is None or job.status not in ("queued", "running"):
            return
        project = db.get(Project, job.project_id)
        job.status, job.stage = "running", job.stage or "Starting"
        db.commit()
        try:
            result = await TASKS[job.task](db, job, project)
            job.status, job.progress, job.stage, job.result = "completed", 100, "Done", result or {}
        except NeedsReview as e:
            job.status, job.error = "needs_review", str(e)
        except ProviderError as e:
            job.status, job.error = "failed", f"AI provider error: {e}"
        except Exception as e:  # never leave a job hanging in "running"
            log.exception("job %s failed", job_id)
            job.status, job.error = "failed", f"Unexpected error: {e.__class__.__name__}"
        db.commit()
    finally:
        db.close()
