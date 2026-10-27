"""Long film (10 min – 2 h): planning, scene-by-scene generation, retry, pause/resume, budget cap, restart
recovery, FFmpeg assembly and validation. Mock providers: clips are labelled TEST CLIP cards (no real footage)."""

import asyncio
import shutil
import subprocess
from pathlib import Path

import pytest

from conftest import auth
from test_api import _plan

needs_ffmpeg = pytest.mark.skipif(not (shutil.which("ffmpeg") and shutil.which("ffprobe")), reason="FFmpeg not installed")
A = auth()


def _planned_film(client, minutes=1.0, **extra):
    pid, job = _plan(client)
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=A).json()["status"] == "completed"
    r = client.post(f"/api/v1/projects/{pid}/film", json={"targetMinutes": minutes, **extra}, headers=A)
    assert r.status_code == 202, r.text
    return pid


def _film(client, pid):
    return client.get(f"/api/v1/projects/{pid}/film", headers=A).json()


def _media_path(url: str) -> Path:
    from app.config import get_settings
    return Path(get_settings().LOCAL_MEDIA_DIR) / url.split("/media/", 1)[1]


def _probe(path: Path) -> dict:
    import json
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,width,height",
                          "-of", "json", str(path)], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


# ---------- planning ----------

def test_scene_count_and_fit_for_one_and_two_hours():
    from app.services.film_planner import _fit_to_target
    from app.services.film_production import scene_count, shots_for
    assert scene_count(10 * 60) == 7 and scene_count(60 * 60) == 40 and scene_count(120 * 60) == 80
    assert scene_count(60) == 3 and shots_for(90, 8) == 12
    scenes = [{"number": i + 1, "act": 0, "seconds": s} for i, s in enumerate([30, 0, 200, 90] * 20)]
    _fit_to_target(scenes, 7200, 8)
    assert sum(s["seconds"] for s in scenes) == 7200 and min(s["seconds"] for s in scenes) >= 8
    assert scenes[0]["act"] == 1 and scenes[-1]["act"] == 3


def test_plan_two_hour_outline_in_batches(client):
    pid = _planned_film(client, minutes=120)
    film = _film(client, pid)
    assert film["status"] == "planned", film
    assert len(film["scenes"]) == 80 and film["targetSeconds"] == 7200
    assert sum(s["targetSeconds"] for s in film["scenes"]) == 7200
    assert [s["number"] for s in film["scenes"]] == list(range(1, 81))
    assert {s["act"] for s in film["scenes"]} == {1, 2, 3}
    names = {c["name"] for c in client.get(f"/api/v1/projects/{pid}", headers=A).json()["memory"]["characters"]}
    assert all(set(s["characters"]) <= names for s in film["scenes"])  # the cast comes from the story bible
    est = film["estimate"]
    assert est["shots"] >= 900 and est["estimatedCost"] == 0  # mock providers are free
    assert est["fullProviderCost"] > 100  # what the same film would cost with every paid provider switched on


def test_story_bible_keeps_cast_and_reference_portraits(client):
    pid = _planned_film(client)
    from app.db import SessionLocal
    from app.services.film_production import production_of
    with SessionLocal() as db:
        bible = production_of(db, pid).story_bible
    assert bible["title"] and bible["characters"] and all("name" in c for c in bible["characters"])
    assert all("portraitRef" in c for c in bible["characters"])


def test_film_needs_a_planned_story_and_validates_input(client):
    p = client.post("/api/v1/projects", json={}, headers=A).json()
    assert client.post(f"/api/v1/projects/{p['id']}/film", json={"targetMinutes": 10}, headers=A).status_code == 409
    pid, _ = _plan(client)
    assert client.post(f"/api/v1/projects/{pid}/film", json={"targetMinutes": 500}, headers=A).status_code == 422
    assert client.post(f"/api/v1/projects/{pid}/film", json={"targetMinutes": 10, "budgetCap": 99999}, headers=A).status_code == 422


def test_owner_only(client):
    pid = _planned_film(client)
    other = auth("someone@else.io")
    for method, path in [("get", ""), ("post", "/generate"), ("post", "/pause"), ("post", "/render"),
                         ("get", "/scenes/1"), ("get", "/download")]:
        r = getattr(client, method)(f"/api/v1/projects/{pid}/film{path}", headers=other, **({"json": {}} if method == "post" else {}))
        assert r.status_code == 404, (path, r.status_code)


# ---------- generation, assembly, validation ----------

@needs_ffmpeg
def test_generate_and_render_one_minute_film(client):
    pid = _planned_film(client)
    r = client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    assert r.status_code == 202, r.text
    film = _film(client, pid)
    assert film["status"] == "generated", film
    assert film["progress"]["shotsDone"] == film["progress"]["shots"] == 9  # 3 scenes × 20 s, 8-second shots
    assert film["hasTestClips"] is True  # honest label: no video provider was used
    scene = client.get(f"/api/v1/projects/{pid}/film/scenes/1", headers=A).json()
    assert scene["script"] and len(scene["shots"]) == 3 and all(s["clipKind"] == "test" for s in scene["shots"])
    assert [s["seconds"] for s in scene["shots"]] == [8, 8, 4]
    assert scene["shots"][0]["dialogue"] and scene["previewUrl"]

    r = client.post(f"/api/v1/projects/{pid}/film/render", headers=A)
    assert r.status_code == 202, r.text
    film = _film(client, pid)
    assert film["status"] == "rendered", film
    info = _probe(_media_path(film["final"]["url"]))
    kinds = {s["codec_type"]: s for s in info["streams"]}
    assert kinds["video"]["codec_name"] == "h264" and (kinds["video"]["width"], kinds["video"]["height"]) == (1280, 720)
    assert kinds["audio"]["codec_name"] == "aac"
    assert abs(float(info["format"]["duration"]) - 60) < 3
    d = client.get(f"/api/v1/projects/{pid}/film/download", headers=A, follow_redirects=False)
    assert d.status_code == 307 and d.headers["location"] == film["final"]["url"]


@needs_ffmpeg
def test_retry_one_failed_shot_only(client, monkeypatch):
    from app.services import scene_generator
    real = scene_generator.make_shot
    calls = []

    async def flaky(db, job, project, prod, scene, shot):
        calls.append((scene.number, shot.number))
        if (scene.number, shot.number) == (2, 2):
            from app.providers import ProviderError
            raise ProviderError("video model timed out")
        return await real(db, job, project, prod, scene, shot)

    monkeypatch.setattr(scene_generator, "make_shot", flaky)
    pid = _planned_film(client)
    client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    film = _film(client, pid)
    assert film["status"] == "failed" and film["progress"]["shotsFailed"] == 1
    assert [s["status"] for s in film["scenes"]] == ["done", "failed", "done"]  # the other scenes carried on
    assert client.post(f"/api/v1/projects/{pid}/film/render", headers=A).status_code == 409

    redone = []

    async def recording(db, job, project, prod, scene, shot):
        redone.append((scene.number, shot.number))
        return await real(db, job, project, prod, scene, shot)

    monkeypatch.setattr(scene_generator, "make_shot", recording)
    shot = next(s for s in client.get(f"/api/v1/projects/{pid}/film/scenes/2", headers=A).json()["shots"] if s["number"] == 2)
    assert shot["status"] == "failed" and "timed out" in shot["error"]
    assert client.post(f"/api/v1/projects/{pid}/film/shots/{shot['id']}/retry", headers=A).status_code == 202
    film = _film(client, pid)
    assert film["status"] == "generated" and film["progress"]["shotsDone"] == 9
    assert redone == [(2, 2)]  # only that shot was made again


@needs_ffmpeg
def test_pause_and_resume(client, monkeypatch):
    from app.services import scene_generator
    real = scene_generator.make_shot

    async def pause_after_first(db, job, project, prod, scene, shot):
        await real(db, job, project, prod, scene, shot)
        if (scene.number, shot.number) == (1, 1):
            prod.pause_requested = True  # what the Pause button does from another request
            db.commit()

    monkeypatch.setattr(scene_generator, "make_shot", pause_after_first)
    pid = _planned_film(client)
    client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    film = _film(client, pid)
    assert film["status"] == "paused" and film["progress"]["shotsDone"] == 1
    monkeypatch.setattr(scene_generator, "make_shot", real)
    assert client.post(f"/api/v1/projects/{pid}/film/resume", json={}, headers=A).status_code == 202
    film = _film(client, pid)
    assert film["status"] == "generated" and film["progress"]["shotsDone"] == 9


def test_pause_needs_running_work(client):
    pid = _planned_film(client)
    assert client.post(f"/api/v1/projects/{pid}/film/pause", headers=A).status_code == 409


@needs_ffmpeg
def test_budget_cap_is_a_hard_stop(client, monkeypatch):
    from app.config import get_settings
    s = get_settings()
    monkeypatch.setattr(s, "IMAGE_PROVIDER", "openai")  # pretend a paid image model is on…
    from app.services import scene_generator

    async def cheap_shot(db, job, project, prod, scene, shot):  # …but don't call it: record its price only
        prod.spent = round(prod.spent + s.COST_PER_IMAGE, 4)
        monkeypatch.setattr(s, "IMAGE_PROVIDER", "mock")
        try:
            await real(db, job, project, prod, scene, shot)
        finally:
            monkeypatch.setattr(s, "IMAGE_PROVIDER", "openai")

    real = scene_generator.make_shot
    monkeypatch.setattr(scene_generator, "make_shot", cheap_shot)
    pid = _planned_film(client, budgetCap=0.1)  # room for two $0.04 shots
    r = client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    assert r.status_code == 202, r.text
    film = _film(client, pid)
    assert film["status"] == "budget_reached", film
    assert film["progress"]["shotsDone"] == 2 and film["spent"] <= 0.1
    assert "Budget cap" in film["error"]
    # raising the cap lets it continue
    client.patch(f"/api/v1/projects/{pid}/film", json={"budgetCap": 1.0}, headers=A)
    client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    film = _film(client, pid)
    assert film["status"] == "generated" and film["spent"] <= 1.0


def test_generate_over_threshold_needs_confirmation(client, monkeypatch):
    from app.config import get_settings
    pid = _planned_film(client, minutes=10)
    monkeypatch.setattr(get_settings(), "VIDEO_PROVIDER", "seedance")
    monkeypatch.setattr(get_settings(), "IMAGE_PROVIDER", "openai")
    est = _film(client, pid)["estimate"]
    assert est["estimatedCost"] > 1
    r = client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    assert r.status_code == 402 and "confirmation" in r.json()["detail"]


def test_one_long_film_at_a_time_per_creator(client):
    pid = _planned_film(client)
    pid2 = _planned_film(client)
    from app.db import SessionLocal
    from app.models import AIJob, Project
    with SessionLocal() as db:  # a film generating in the background
        db.add(AIJob(project_id=pid, user_id=db.get(Project, pid).user_id, task="film_generate", status="running"))
        db.commit()
    r = client.post(f"/api/v1/projects/{pid2}/film/generate", json={}, headers=A)
    assert r.status_code == 429
    assert client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A).status_code in (409, 429)


@needs_ffmpeg
def test_restart_recovery_continues_without_redoing_work(client):
    pid = _planned_film(client)
    from app.db import SessionLocal
    from app.models import AIJob, FilmScene, FilmShot, Project
    from app.services.film_production import production_of, recover_interrupted
    from app.services.scene_generator import break_down
    with SessionLocal() as db:  # state after a crash: scene 1 written, shot 1 done, shot 2 half made, job "running"
        prod = production_of(db, pid)
        user_id = db.get(Project, pid).user_id
        job = AIJob(project_id=pid, user_id=user_id, task="film_generate", status="running")
        db.add(job)
        db.commit()
        sc = prod.scenes[0]
        asyncio.run(break_down(db, job, prod, sc))
        sc.shots[0].status, sc.shots[0].video_asset_id = "done", None
        sc.shots[1].status = "generating"
        prod.status = "generating"
        db.commit()
        stuck_id = job.id

    async def restart():
        ids = await recover_interrupted()
        await asyncio.sleep(0)
        from app.services.pipeline import run_job
        for i in ids:  # the startup hook schedules these; run them here to the end
            await run_job(i)
        return ids

    ids = asyncio.run(restart())
    assert len(ids) == 1
    with SessionLocal() as db:
        assert db.get(AIJob, stuck_id).status == "failed"
        assert db.get(AIJob, ids[0]).status == "completed"
        shots = db.query(FilmShot).join(FilmScene).filter(FilmScene.number == 1).order_by(FilmShot.number).all()
        assert shots[0].video_asset_id is None  # the shot finished before the crash was not made again
        assert all(s.status == "done" for s in shots[1:])


def test_restart_recovery_marks_failed_job_states(client):
    """A film job that crashes never leaves the film stuck in "generating"."""
    pid = _planned_film(client)
    from app.db import SessionLocal
    from app.models import AIJob, Project
    from app.services.film_production import job_stopped, production_of
    with SessionLocal() as db:
        prod = production_of(db, pid)
        prod.status = "generating"
        job = AIJob(project_id=pid, user_id=db.get(Project, pid).user_id, task="film_generate", status="failed", error="boom")
        db.add(job)
        db.commit()
        job_stopped(db, job)
        assert production_of(db, pid).status == "failed" and production_of(db, pid).error == "boom"


@needs_ffmpeg
def test_render_validation_catches_a_bad_file(tmp_path):
    from app.services.film_renderer import RenderError, validate
    bad = tmp_path / "bad.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=640x360:d=2",
                    "-pix_fmt", "yuv420p", str(bad)], check=True)
    with pytest.raises(RenderError) as e:
        validate(bad, expected_seconds=10, w=1280, h=720, label="Test")
    msg = str(e.value)
    assert "audio" in msg and "640" in msg and "10.0s" in msg


def test_teaser_flow_unchanged(client):
    pid, job = _plan(client)
    assert client.get(f"/api/v1/projects/{pid}/film", headers=A).json() is None  # no long film unless asked
    r = client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=A)
    assert r.status_code == 202 and r.json()["task"] == "generate"


def test_deleting_the_project_removes_the_film(client):
    pid = _planned_film(client)
    assert client.delete(f"/api/v1/projects/{pid}", headers=A).status_code == 204
    from app.db import SessionLocal
    from app.models import FilmProduction, FilmScene
    with SessionLocal() as db:
        assert db.query(FilmProduction).count() == 0 and db.query(FilmScene).count() == 0


# ---------- editing a scene ----------

def _generated(client):
    pid = _planned_film(client)
    client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    assert _film(client, pid)["status"] == "generated"
    return pid


@needs_ffmpeg
def test_hand_edit_remakes_only_the_changed_shot(client, monkeypatch):
    pid = _generated(client)
    client.post(f"/api/v1/projects/{pid}/film/render", headers=A)
    assert _film(client, pid)["status"] == "rendered"
    scene = client.get(f"/api/v1/projects/{pid}/film/scenes/2", headers=A).json()
    first, second = scene["shots"][0], scene["shots"][1]
    r = client.patch(f"/api/v1/projects/{pid}/film/scenes/2", headers=A, json={
        "script": "INT. RIVER — DAWN\nPaati waits.",
        "shots": [{"id": second["id"], "dialogue": [{"character": "Paati", "text": "Breathe, kanna. The river is a friend."}]},
                  {"id": first["id"], "description": first["description"]}]})  # unchanged → kept
    assert r.status_code == 200, r.text
    edited = r.json()
    assert edited["script"].startswith("INT. RIVER")
    assert edited["shots"][1]["dialogue"][0]["text"].startswith("Breathe")
    assert edited["shots"][1]["status"] == "pending" and edited["shots"][0]["status"] == "done"
    film = _film(client, pid)
    assert film["status"] == "paused" and film["final"] is None  # the old film no longer matches
    assert [s["status"] for s in film["scenes"]] == ["done", "planned", "done"]

    from app.services import scene_generator
    real, made = scene_generator.make_shot, []

    async def recording(db, job, project, prod, sc, sh):
        made.append((sc.number, sh.number))
        return await real(db, job, project, prod, sc, sh)

    monkeypatch.setattr(scene_generator, "make_shot", recording)
    client.post(f"/api/v1/projects/{pid}/film/generate", json={}, headers=A)
    assert made == [(2, 2)]
    assert _film(client, pid)["status"] == "generated"


def test_text_only_edit_keeps_the_clips(client):
    pid = _planned_film(client)
    from app.db import SessionLocal
    from app.models import FilmScene
    with SessionLocal() as db:
        sc = db.query(FilmScene).filter(FilmScene.number == 1).one()
        sc.status = "done"
        db.commit()
    r = client.patch(f"/api/v1/projects/{pid}/film/scenes/1", headers=A, json={"title": "Paati's River", "summary": "New summary"})
    assert r.status_code == 200 and r.json()["title"] == "Paati's River" and r.json()["status"] == "done"


def test_direct_the_ai_rewrites_one_scene(client):
    pid = _planned_film(client)
    r = client.post(f"/api/v1/projects/{pid}/film/scenes/2/rewrite", headers=A, json={"instruction": "Make it rain and more emotional"})
    assert r.status_code == 202, r.text
    assert client.get(f"/api/v1/jobs/{r.json()['id']}", headers=A).json()["status"] == "completed"
    scene = client.get(f"/api/v1/projects/{pid}/film/scenes/2", headers=A).json()
    assert "[Revised: Make it rain and more emotional]" in scene["script"]
    assert len(scene["shots"]) == 3 and all("[Revised:" in s["description"] for s in scene["shots"])
    assert all(s["status"] == "pending" for s in scene["shots"])
    other = client.get(f"/api/v1/projects/{pid}/film/scenes/1", headers=A).json()
    assert other["shots"] == []  # other scenes untouched (not written yet)


def test_edit_rules(client):
    pid = _planned_film(client)
    assert client.post(f"/api/v1/projects/{pid}/film/scenes/1/rewrite", headers=A, json={"instruction": ""}).status_code == 422
    assert client.patch(f"/api/v1/projects/{pid}/film/scenes/1", headers=A, json={"shots": [{"id": "nope", "description": "x"}]}).status_code == 404
    assert client.patch(f"/api/v1/projects/{pid}/film/scenes/1", headers=auth("x@y.z"), json={"title": "x"}).status_code == 404
    from app.db import SessionLocal
    from app.services.film_production import production_of
    with SessionLocal() as db:
        production_of(db, pid).status = "generating"
        db.commit()
    assert client.patch(f"/api/v1/projects/{pid}/film/scenes/1", headers=A, json={"title": "x"}).status_code == 409
    assert client.post(f"/api/v1/projects/{pid}/film/scenes/1/rewrite", headers=A, json={"instruction": "x"}).status_code == 409


# ---------- scripts only (no video) ----------

def test_write_scripts_only_makes_no_video(client):
    pid = _planned_film(client)
    r = client.post(f"/api/v1/projects/{pid}/film/scripts", headers=A)
    assert r.status_code == 202, r.text
    film = _film(client, pid)
    assert film["status"] == "planned", film  # back where it was — nothing was filmed
    assert all(s["scripted"] and s["shots"] > 0 and s["shotsDone"] == 0 for s in film["scenes"])
    from app.db import SessionLocal
    from app.models import Asset
    with SessionLocal() as db:
        assert db.query(Asset).filter(Asset.type.in_(("film_clip", "film_voice", "film_frame", "film_scene"))).count() == 0
    # the whole screenplay downloads as one text file
    d = client.get(f"/api/v1/projects/{pid}/film/script", headers=A)
    assert d.status_code == 200 and "attachment" in d.headers["content-disposition"]
    text = d.text
    assert text.count("SCENE ") == 3 and "SHOTS" in text and "Line 1 of scene 1." in text
    # writing again keeps what's written (no extra story calls)
    from app.services import scene_generator
    calls = []
    real = scene_generator.break_down

    async def counting(*a, **k):
        calls.append(1)
        return await real(*a, **k)

    import pytest as _p  # noqa
    scene_generator.break_down, saved = counting, real
    try:
        client.post(f"/api/v1/projects/{pid}/film/scripts", headers=A)
    finally:
        scene_generator.break_down = saved
    assert calls == []


def test_script_download_before_writing_shows_outline(client):
    pid = _planned_film(client)
    text = client.get(f"/api/v1/projects/{pid}/film/script", headers=A).text
    assert "[Not written yet]" in text
    assert client.get(f"/api/v1/projects/{pid}/film/script", headers=auth("x@y.z")).status_code == 404
