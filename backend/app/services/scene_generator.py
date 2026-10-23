"""Long film, step 2: scene by scene — script and shot list, then one clip (with voice) per shot, then a scene file.

Rules:
- Work already done is never made again: finished shots and scenes are skipped, so a pause, a crash or a retry
  continues where it stopped.
- Each shot is tried at most MAX_SHOT_ATTEMPTS times; after that it waits for the creator's "Retry".
- Before every paid call the film's hard budget cap is checked; reaching it stops the job (status budget_reached).
- The pause button is honoured between shots.
- The clip a shot gets depends on what is connected — and is labelled honestly:
    video provider  → frame image (with the cast's reference portraits) → AI video clip
    image provider only → the AI frame held as a still shot
    neither (mock)  → a "TEST CLIP" card with the shot description, so the film's timing and assembly can be checked
"""

import logging
import tempfile
import time
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import AIJob, FilmProduction, FilmScene, FilmShot, Project
from app.providers import ProviderError, image_provider, story_provider, tts_provider, video_provider
from app.providers.base import ProviderResult
from app.services import reference_portraits, storage
from app.services.film_production import (MAX_SHOT_ATTEMPTS, BudgetReached, Paused, check_budget, check_pause,
                                          frame_size, live_providers, production_of, progress, shot_cost, shots_for,
                                          story_call_cost)
from app.services.film_renderer import RenderError, scene_preview, shot_clip, test_card, voice_track
from app.services.pipeline import (ASPECT_SIZES, NeedsReview, record_usage, set_progress, store_asset, style_prompt,
                                   user_preferences, with_retry)

log = logging.getLogger("cineai.film")


def _neighbour(prod: FilmProduction, number: int) -> dict | None:
    sc = next((s for s in prod.scenes if s.number == number), None)
    if sc is None:
        return None
    return {"number": sc.number, "title": sc.title, "summary": sc.summary, "location": sc.location,
            "continuity": sc.continuity or ""}


def _clean_shot(raw: object, shot_seconds: int, scene_chars: list[str]) -> dict:
    s = raw if isinstance(raw, dict) else {}
    lines = [{"character": str(d.get("character") or ""), "text": str(d.get("text") or "").strip()}
             for d in (s.get("dialogue") or []) if isinstance(d, dict) and str(d.get("text") or "").strip()]
    chars = [str(c) for c in s.get("characters") or [] if str(c).strip()] if isinstance(s.get("characters"), list) else []
    return {"description": str(s.get("description") or "")[:2000], "camera": str(s.get("camera") or "Medium")[:100],
            "movement": str(s.get("movement") or "Static")[:100], "characters": chars or scene_chars[:1],
            "dialogue": lines[:4], "seconds": float(shot_seconds)}


async def break_down(db: Session, job: AIJob, prod: FilmProduction, scene: FilmScene) -> None:
    """Write the scene's script and shot list (once; kept for every later run)."""
    check_budget(prod, story_call_cost())
    count = shots_for(scene.target_seconds, prod.shot_seconds)
    scene_dict = {"number": scene.number, "act": scene.act, "title": scene.title, "summary": scene.summary,
                  "location": scene.location, "characters": scene.characters, "seconds": scene.target_seconds}
    total = len(prod.scenes)
    res = await with_retry(lambda: story_provider().break_down_scene(
        prod.story_bible, scene_dict, total=total, shot_count=count, shot_seconds=prod.shot_seconds,
        previous=_neighbour(prod, scene.number - 1), next_scene=_neighbour(prod, scene.number + 1),
        language=prod.story_bible.get("language", "en")), job, db)
    record_usage(db, job, res)
    prod.spent = round(prod.spent + res.cost, 4)
    data = res.data if isinstance(res.data, dict) else {}
    raw = [x for x in data.get("shots") or [] if isinstance(x, dict)]
    if not raw:
        raise ProviderError(f"The story model returned no shots for scene {scene.number}.")
    shots = [_clean_shot(x, prod.shot_seconds, scene.characters) for x in raw[:count]]
    while len(shots) < count:  # a short reply: hold the scene's last shot so the timing still adds up
        shots.append({**shots[-1], "dialogue": [], "description": shots[-1]["description"] + " (continues)"})
    # the last shot takes the remainder, so the scene lasts what the outline planned
    shots[-1]["seconds"] = max(2.0, scene.target_seconds - prod.shot_seconds * (count - 1))
    scene.script, scene.continuity = str(data.get("script") or ""), str(data.get("continuity") or "")
    for i, s in enumerate(shots, start=1):
        db.add(FilmShot(scene_id=scene.id, number=i, **s))
    db.commit()
    db.refresh(scene)


def _references(prod: FilmProduction, names: list[str]) -> list[bytes]:
    out = []
    for c in prod.story_bible.get("characters", []):
        if any(n and (n == c.get("name") or n.split()[0] in c.get("name", "")) for n in names) and c.get("portraitRef"):
            data = reference_portraits.reference_bytes(c["portraitRef"])
            if data:
                out.append(data)
    return out[:3]


async def make_shot(db: Session, job: AIJob, project: Project, prod: FilmProduction, scene: FilmScene, shot: FilmShot) -> None:
    live, w, h = live_providers(), *frame_size(project)
    timing: dict[str, float] = {}
    t0 = time.monotonic()
    aspect = (project.brief or {}).get("aspectRatio", "16:9")
    ref = f"{scene.number}-{shot.number}"
    bible_looks = "; ".join(f"{c['name']}: {c.get('appearance', '')}" for c in prod.story_bible.get("characters", [])
                            if c.get("name") in shot.characters)
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        frame_file = video_file = None
        frame = None
        if live["image"]:
            prompt = (f"Film still, scene {scene.number} ({scene.location}): {shot.camera} shot, {shot.movement}. "
                      f"{shot.description} {bible_looks}. {style_prompt(project)}")
            refs = _references(prod, shot.characters)
            res = await with_retry(lambda: image_provider().generate_image(prompt, size=ASPECT_SIZES.get(aspect, "1536x1024"),
                                                                           references=refs or None), job, db)
            record_usage(db, job, res)
            prod.spent = round(prod.spent + res.cost, 4)
            if res.data and res.data.lstrip()[:4] not in (b"<svg", b"<?xm"):
                frame = await store_asset(db, project, "film_frame", ref, res, data=res.data, ext="png", meta={"prompt": prompt})
                shot.frame_asset_id = frame.id
                frame_file = tmp / "frame.png"
                frame_file.write_bytes(res.data)
        if live["video"] and frame is not None:
            prompt = f"{shot.movement}. {shot.description} Cinematic, natural motion."
            res = await with_retry(lambda: video_provider().generate_video(
                prompt, image_url=frame.url, duration=max(2, min(12, round(shot.seconds))), quality=prod.quality,
                aspect_ratio=aspect), job, db)
            record_usage(db, job, res)
            prod.spent = round(prod.spent + res.cost, 4)
            if res.data:
                video_file = tmp / "provider.mp4"
                video_file.write_bytes(await storage.download(res.data))
        timing["picture"] = time.monotonic() - t0
        kind = "video" if video_file else "still" if frame_file else "test"
        if kind == "test":
            frame_file = tmp / "card.png"
            frame_file.write_bytes(test_card(w, h, scene, shot.number, shot.description))
        # Voice: each dialogue line through TTS, joined into one track for the shot
        wavs = []
        if shot.dialogue:
            prefs = user_preferences(db, project.user_id)
            for line in shot.dialogue:
                res = await with_retry(lambda: tts_provider().generate_voice(line["text"], language=project.language,
                                                                             speaker=prefs.voice or None, pace=prefs.voice_pace), job, db)
                record_usage(db, job, res)
                prod.spent = round(prod.spent + res.cost, 4)
                if res.data:
                    wavs.append(res.data)
        timing["voice"] = time.monotonic() - t0 - timing["picture"]
        t1 = time.monotonic()
        audio = await voice_track(tmp, wavs)
        if audio:
            a = await store_asset(db, project, "film_voice", ref, ProviderResult(None, provider=get_settings().TTS_PROVIDER, model="tts"),
                                  data=audio.read_bytes(), ext="m4a", meta={"lines": shot.dialogue})
            shot.audio_asset_id = a.id
        clip = await shot_clip(tmp, w=w, h=h, seconds=shot.seconds, video=video_file,
                               still=None if video_file else frame_file, audio=audio)
        asset = await store_asset(db, project, "film_clip", ref, ProviderResult(None, provider="ffmpeg", model=kind),
                                  data=clip.read_bytes(), ext="mp4", meta={"kind": kind, "testClip": kind == "test"})
        timing["ffmpeg"] = time.monotonic() - t1
    shot.video_asset_id = asset.id
    db.commit()
    log.info("scene %s shot %s (%s): picture %.1fs · voice %.1fs (%d lines) · ffmpeg %.1fs", scene.number, shot.number, kind,
             timing["picture"], timing["voice"], len(wavs), timing["ffmpeg"])


async def task_film_generate(db: Session, job: AIJob, project: Project) -> dict:
    prod = production_of(db, project.id)
    if prod is None or not prod.scenes:
        raise NeedsReview("Plan the full-length film's scenes first.")
    prod.status, prod.error, prod.pause_requested = "generating", "", False
    db.commit()
    started, slice_seconds = time.monotonic(), get_settings().LONG_FILM_SLICE_SECONDS
    scenes = list(prod.scenes)
    try:
        for sc in scenes:
            if sc.status == "done" and sc.preview_asset_id:
                continue
            check_pause(db, prod)
            if not sc.shots:
                set_progress(db, job, f"Scene {sc.number} of {len(scenes)}: writing the script", progress(prod)["percent"])
                try:
                    t = time.monotonic()
                    await break_down(db, job, prod, sc)
                    log.info("scene %s: script and %d shots written in %.1fs", sc.number, len(sc.shots), time.monotonic() - t)
                except ProviderError as e:
                    sc.status, sc.error = "failed", f"Script: {e}"
                    db.commit()
                    continue
            sc.status, sc.error = "generating", ""
            db.commit()
            for sh in sc.shots:
                if sh.status == "done":
                    continue
                if sh.attempts >= MAX_SHOT_ATTEMPTS:
                    sh.status = "failed"
                    continue
                check_pause(db, prod)
                check_budget(prod, shot_cost(sh.seconds, len(sh.dialogue or []), prod.quality))
                set_progress(db, job, f"Scene {sc.number} of {len(scenes)}: shot {sh.number} of {len(sc.shots)}",
                             progress(prod)["percent"])
                sh.status, sh.attempts, sh.error = "generating", sh.attempts + 1, ""
                db.commit()
                try:
                    await make_shot(db, job, project, prod, sc, sh)
                    sh.status = "done"
                except (ProviderError, RenderError) as e:
                    sh.status, sh.error = "failed", str(e)[:500]
                    log.warning("scene %s shot %s failed: %s", sc.number, sh.number, e)
                db.commit()
            if all(sh.status == "done" for sh in sc.shots):
                try:
                    await scene_preview(db, project, sc)
                    sc.status = "done"
                except RenderError as e:
                    sc.status, sc.error = "failed", str(e)
            else:
                sc.status = "failed"
                sc.error = f"{sum(sh.status != 'done' for sh in sc.shots)} shot(s) failed — retry them."
            db.commit()
            if time.monotonic() - started > slice_seconds and any(s.status != "done" for s in scenes):
                return {"continue": True, **progress(prod)}  # run_job starts a fresh job for the rest
    except Paused:
        prod.status, prod.pause_requested = "paused", False
        db.commit()
        return {"paused": True, **progress(prod)}
    except BudgetReached as e:
        for sh in (s for sc in scenes for s in sc.shots if s.status == "generating"):
            sh.status = "pending"
        prod.status, prod.error = "budget_reached", str(e)
        db.commit()
        return {"budgetReached": True, **progress(prod)}
    p = progress(prod)
    if p["scenesDone"] == p["scenes"]:
        prod.status = "generated"
    else:
        prod.status = "failed"
        prod.error = f"{p['scenes'] - p['scenesDone']} scene(s) are not finished — retry the failed shots."
    db.commit()
    return p
