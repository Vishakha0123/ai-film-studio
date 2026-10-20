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
import time
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TypeVar

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import SessionLocal
from app.models import AIJob, Asset, Project, ProjectDocument, UsageEvent, User
from app.providers import ProviderError, image_provider, story_provider, tts_provider, video_provider
from app.providers.base import ProviderResult
from app.schemas import FilmProject, Preferences
from app.services import storage
from app.services.script_check import CHECKED, wrong_language_fields

log = logging.getLogger("cineai.pipeline")
T = TypeVar("T")

ASPECT_SIZES = {"16:9": "1536x1024", "9:16": "1024x1536", "1:1": "1024x1024"}
VISUAL_STYLE = "cinematic film still, dark cinema look, desaturated palette with warm amber practical light, 35mm, shallow depth of field"
STYLE_PROMPTS = {
    "photorealistic": "photorealistic film still, natural light and colour, 35mm, shallow depth of field",
    "dark cinema": VISUAL_STYLE,
    "anime": "anime style key frame, clean line art, cel shading, vivid colours, painted background",
    "3d render": "stylised 3D render, Pixar-like lighting, soft global illumination, detailed materials",
    "vintage": "vintage film still, 1970s colour stock, warm faded tones, film grain, soft halation",
}


def user_preferences(db: Session, user_id: str) -> Preferences:
    """The creator's saved Settings (defaults when they never saved any)."""
    row = db.get(User, user_id)
    return Preferences.model_validate(((row.profile if row else None) or {}).get("preferences", {}))


def style_prompt(project) -> str:
    """The storyboard look the creator picked (or their own words for Custom); Dark Cinema by default."""
    chosen = ((project.memory or {}).get("visualStyle") or "").strip()
    return STYLE_PROMPTS.get(chosen.lower(), chosen or VISUAL_STYLE)


class NeedsReview(Exception):
    """Stop the job and ask the creator to review (no safe automatic fallback)."""


# ---------------------------------------------------------------- helpers

def _seconds(duration: str, default: float = 2.5) -> float:
    try:
        return float(str(duration).rstrip("s").strip())
    except ValueError:
        return default


def _problems(e: ValidationError) -> str:
    """'2 problems: characters.0.name missing, title missing' — enough to see what the model got wrong."""
    where = [f"{'.'.join(map(str, err['loc']))} {'missing' if err['type'] == 'missing' else 'invalid'}" for err in e.errors()[:4]]
    log.warning("film validation failed: %s", e.errors()[:10])
    return f"{e.error_count()} problem{'s' if e.error_count() != 1 else ''}: {', '.join(where)}"


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
    brief["language"] = brief.get("language") or project.language or "en"  # film language, not the prompt's
    prefs = user_preferences(db, project.user_id)
    brief.setdefault("filmLength", prefs.film_length)  # Settings → Film length decides the scene count
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
    started = time.monotonic()
    res = await with_retry(lambda: story_provider().plan_film(brief), job, db)
    log.info("plan took %.1fs", time.monotonic() - started)
    record_usage(db, job, res)
    set_progress(db, job, "Writing story, characters and screenplay", 70)
    try:
        memory = validate_film(res.data)
    except ValidationError as e:
        raise NeedsReview(f"The story model returned an incomplete plan ({_problems(e)}). Try again.") from e
    if prefs.visual_style and not memory.get("visualStyle"):
        memory["visualStyle"] = prefs.visual_style  # Settings → Visual style is where every new film starts
    memory = await fix_language(db, job, memory, brief["language"])
    project.memory = memory
    project.title = memory["title"][:300]
    project.genre = memory.get("genre", project.genre)[:200]
    project.status = "planned"
    mark_outdated(db, project.id, ["character_image", "storyboard_image", "video_clip", "voice", "render"])
    db.commit()
    return {"title": project.title}


async def fix_language(db: Session, job: AIJob, memory: dict, language: str, only: tuple[str, ...] = CHECKED) -> dict:
    """If the model wrote some parts in the wrong language (often the screenplay in English), translate just those.

    One extra pass at most; if it still isn't right we keep what we have rather than fail the job.
    """
    wrong = wrong_language_fields(memory, language, only)
    if not wrong:
        return memory
    log.warning("film language %s: %s came back in another language — translating them", language, ", ".join(wrong))
    set_progress(db, job, "Putting everything in the film's language", 85)
    try:
        res = await with_retry(lambda: story_provider().translate_film({k: memory[k] for k in wrong}, language), job, db)
    except ProviderError:
        return memory
    record_usage(db, job, res)
    data = res.data if isinstance(res.data, dict) else {}
    fixed = dict(memory)
    for k in wrong:
        new, old = data.get(k), memory[k]
        if isinstance(old, list):
            if isinstance(new, list) and len(new) == len(old):
                fixed[k] = [{**o, **n} if isinstance(o, dict) and isinstance(n, dict) else o for o, n in zip(old, new)]
        elif isinstance(old, dict):
            if isinstance(new, dict):
                fixed[k] = {**old, **new}
        elif isinstance(new, str) and new.strip():
            fixed[k] = new
    try:
        return validate_film(fixed)
    except ValidationError:
        return memory


EDIT_DEPENDENTS = {
    "characters": ["character_image", "storyboard_image", "video_clip", "render"],
    "shots": ["storyboard_image", "video_clip", "render"],
    "dialogue": ["voice", "render"],
    "story": [], "logline": [], "screenplay": [], "scenes": [], "lyrics": [], "tone": [],
    "visualStyle": ["character_image", "storyboard_image", "video_clip", "render"],
}


LIST_TARGETS = {"dialogue", "characters", "scenes", "shots"}


def _unwrap(data: object, target: str) -> tuple[object, bool]:
    """Models sometimes wrap the answer: {"dialogue": [...]}, {"scene": 2, "lines": [...]} or a lone item.

    Returns the list and whether the reply was explicitly for one scene only.
    """
    if target in LIST_TARGETS and isinstance(data, dict):
        if isinstance(data.get(target), list):
            return data[target], False
        lists = [v for v in data.values() if isinstance(v, list)]
        if len(lists) == 1:
            scene = data.get("scene") or data.get("sceneNumber")
            def labelled(it: object) -> object:
                if not scene:
                    return it
                if isinstance(it, str):  # "Bhoot-ji: I prefer the dark."
                    who, sep, said = it.partition(":")
                    it = {"character": who.strip(), "text": said.strip()} if sep and len(who) < 40 else {"text": it.strip()}
                return {**it, "scene": it.get("scene", scene)} if isinstance(it, dict) else it
            items = [labelled(it) for it in lists[0]]
            return items, bool(scene)
        return [data], False
    return data, False


def _scene_of(line: object) -> int | None:
    if not isinstance(line, dict) or line.get("scene") in (None, ""):
        return None
    digits = "".join(c for c in str(line["scene"]) if c.isdigit())
    return int(digits) if digits else None


def _merge_dialogue(before: list, reply: object, scene_only: bool) -> object:
    """A reply that covers only some scenes (e.g. "give me scene 2's dialogue") must not wipe the others."""
    if not isinstance(reply, list) or not before:
        return reply
    scenes = {_scene_of(d) for d in reply}
    if not scenes or None in scenes:
        return reply  # an unlabelled list is the model's whole new dialogue
    covered = {_scene_of(line) for line in before} <= scenes
    if covered and not scene_only:
        return reply  # it rewrote every scene that had lines
    kept = [line for line in before if _scene_of(line) not in scenes]
    return sorted(kept + reply, key=lambda d: _scene_of(d) or 0)  # stable: order kept within a scene


def edit_context(memory: dict, target: str, value: object) -> dict:
    """What the story model needs to rewrite one part: the film's essentials plus the part itself.

    The full film (above all the screenplay) can be many thousands of tokens; sending only this keeps
    each edit fast without losing names, tone or story.
    """
    ctx = {k: memory.get(k) for k in ("title", "genre", "tone", "logline") if memory.get(k)}
    if target != "story" and memory.get("story"):
        ctx["story"] = memory["story"][:1500]
    if target != "characters":
        ctx["characters"] = [{k: c.get(k, "") for k in ("id", "name", "role", "personality")} for c in memory.get("characters", [])]
    if target == "dialogue":
        ctx["scenes"] = [{k: s.get(k, "") for k in ("number", "location", "description", "characters")} for s in memory.get("scenes", [])]
    ctx[target] = value
    return ctx


def _find_item(items: list, ref: str) -> int | None:
    for i, it in enumerate(items):
        if isinstance(it, dict) and str(it.get("id", "")) == ref:
            return i
    return int(ref) - 1 if ref.isdigit() and 0 < int(ref) <= len(items) else None


async def task_edit(db: Session, job: AIJob, project: Project) -> dict:
    target, instruction = job.params["target"], job.params.get("instruction", "")
    passage, item = job.params.get("passage"), job.params.get("item")
    if not project.memory:
        raise NeedsReview("Plan the film before editing it.")
    current = project.memory.get(target)
    set_progress(db, job, f"Revising {target}", 30)

    # Scope: a selected passage of a text field, or one item of a list — the model writes only that.
    value, splice = current, None
    if passage and isinstance(current, str) and passage in current:
        value = passage
        instruction = f"{instruction}\n(The \"{target}\" value below is only the selected passage: return just that passage, changed.)"
        splice = lambda new: current.replace(passage, new if isinstance(new, str) else str(new), 1)  # noqa: E731
    elif passage:  # the selection didn't match the stored text exactly: edit the whole field, pointing at it
        instruction = f"{instruction}\nApply this only to this passage and keep the rest exactly as it is:\n\"\"\"{passage[:2000]}\"\"\""
    elif item and isinstance(current, list) and (idx := _find_item(current, item)) is not None:
        value = [current[idx]]
        instruction = f"{instruction}\n(The \"{target}\" list below holds only the item to change: return a list with that item changed, plus any new items the instruction asks for right after it.)"
        splice = lambda new: current[:idx] + (new if isinstance(new, list) else [new]) + current[idx + 1:]  # noqa: E731

    started = time.monotonic()
    ctx = edit_context(project.memory, target, value)
    res = await with_retry(lambda: story_provider().edit(ctx, target, instruction, language=project.language or "en"), job, db)
    log.info("edit %s (%s) took %.1fs", target, "scoped" if splice else "whole", time.monotonic() - started)
    record_usage(db, job, res)
    data, scene_only = _unwrap(res.data, target)
    if target == "dialogue" and not splice:
        data = _merge_dialogue(current or [], data, scene_only)
    memory = dict(project.memory)
    memory[target] = splice(data) if splice else data
    try:
        project.memory = validate_film(memory)
    except ValidationError as e:
        raise NeedsReview(f"The AI's reply didn't fit the {target} format ({_problems(e)}). Try again, or say it differently.") from e
    if target in CHECKED:
        project.memory = await fix_language(db, job, project.memory, project.language or "en", (target,))
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
    prompt = f"Character portrait of {char['name']}, {char.get('age', '')} years old, {char.get('role', '')}. {char.get('appearance', '')}. {style_prompt(project)}"
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
    prompt = f"Storyboard frame, shot {shot['number']}: {shot.get('camera', '')} shot, {shot.get('movement', '')}. {shot.get('description', '')} Mood: {shot.get('mood', '')}. {looks}. {style_prompt(project)}"
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
    prefs = user_preferences(db, project.user_id)
    res = await with_retry(lambda: tts_provider().generate_voice(line["text"], language=project.language,
                                                                 speaker=prefs.voice or None, pace=prefs.voice_pace), job, db)
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


# Fields that aren't words: kept out of translation and restored afterwards, by position.
_VISUAL_KEYS = ("imageId", "imageUrl", "videoUrl", "url")
VISUAL_ASSET_TYPES = ("character_image", "storyboard_image", "video_clip")


def _split_visuals(memory: dict) -> tuple[dict, dict]:
    text, visuals = {}, {}
    for key, value in memory.items():
        if isinstance(value, list) and value and all(isinstance(x, dict) for x in value):
            text[key] = [{k: v for k, v in item.items() if k not in _VISUAL_KEYS} for item in value]
            visuals[key] = [{k: item[k] for k in _VISUAL_KEYS if k in item} for item in value]
        else:
            text[key] = value
    return text, visuals


async def task_translate(db: Session, job: AIJob, project: Project) -> dict:
    """A language version: the source film's story, cast, screenplay and storyboard in another language.

    Pictures and clips carry over (they have no words); voice lines and renders are made again later.
    """
    source = db.get(Project, job.params["sourceProjectId"])
    language = job.params["language"]
    if source is None or not source.memory:
        raise NeedsReview("The original film isn't planned yet, so there's nothing to translate.")
    set_progress(db, job, "Translating the film", 20)
    text, visuals = _split_visuals(source.memory)
    res = await with_retry(lambda: story_provider().translate_film(text, language), job, db)
    record_usage(db, job, res)
    set_progress(db, job, "Checking the translation", 80)
    data = res.data if isinstance(res.data, dict) else {}
    for key, items in visuals.items():
        translated = data.get(key)
        if not isinstance(translated, list) or len(translated) != len(items):
            raise NeedsReview(f"The translation changed the number of {key}. Try again.")
        data[key] = [{**t, **v} for t, v in zip(translated, items)]
    try:
        memory = validate_film(data)
    except ValidationError as e:
        raise NeedsReview(f"The translated film was incomplete ({_problems(e)}). Try again.") from e
    memory = await fix_language(db, job, memory, language)

    copied = 0
    for a in db.scalars(select(Asset).where(Asset.project_id == source.id, Asset.type.in_(VISUAL_ASSET_TYPES),
                                            Asset.status == "ready")).all():
        db.add(Asset(project_id=project.id, type=a.type, ref=a.ref, url=a.url, provider=a.provider, model=a.model,
                     version=a.version, status="ready", dependencies=[], meta={**(a.meta or {}), "copiedFrom": a.id}))
        copied += 1
    project.memory = memory
    project.title = memory["title"][:300]
    project.genre = memory.get("genre", source.genre)[:200]
    project.status = "generated" if copied else "planned"
    db.commit()
    return {"title": project.title, "language": language, "sourceProjectId": source.id, "copiedAssets": copied}


TASKS = {"plan": task_plan, "edit": task_edit, "translate": task_translate, "generate": task_generate, "regenerate": task_regenerate, "render": task_render}


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
