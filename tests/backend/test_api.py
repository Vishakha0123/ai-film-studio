"""API + pipeline tests (mock providers, in-process jobs, SQLite)."""

import pytest
import respx
from httpx import Response

from conftest import auth


def _plan(client, prompt="A composer hears her late husband's symphony"):
    p = client.post("/api/v1/projects", json={"genres": ["Horror", "Thriller"]}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/brief", json={"prompt": prompt, "genres": ["Horror"], "teaserSeconds": 30}, headers=auth())
    job = client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth()).json()
    return p["id"], job


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_requires_auth(client):
    assert client.get("/api/v1/projects").status_code == 401
    assert client.get("/api/v1/projects", headers={"Authorization": "Bearer nope"}).status_code == 401


def test_me_creates_user(client):
    r = client.get("/api/v1/me", headers=auth("a@b.co"))
    assert r.status_code == 200 and r.json()["email"] == "a@b.co"


def test_project_crud_and_ownership(client):
    p = client.post("/api/v1/projects", json={"title": "Mine", "genres": ["Drama"]}, headers=auth()).json()
    assert p["genre"] == "Drama" and p["memory"] is None
    assert [x["id"] for x in client.get("/api/v1/projects", headers=auth()).json()] == [p["id"]]
    # another user cannot see it
    assert client.get(f"/api/v1/projects/{p['id']}", headers=auth("other@x.io")).status_code == 404
    assert client.get("/api/v1/projects", headers=auth("other@x.io")).json() == []


def test_plan_job_builds_project_memory(client):
    pid, job = _plan(client)
    assert job["task"] == "plan"
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "completed", done
    assert done["progress"] == 100
    project = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()
    mem = project["memory"]
    assert mem["title"] == "Echoes of the Forgotten"
    assert len(mem["characters"]) == 3 and len(mem["shots"]) == 4
    assert mem["audioTracks"][0]["type"] == "voice"
    assert project["status"] == "planned"


def test_plan_without_prompt_needs_review(client):
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    job = client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "needs_review" and "idea" in done["error"]


def test_generate_requires_plan(client):
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    assert client.post(f"/api/v1/projects/{p['id']}/generate", json={}, headers=auth()).status_code == 409


def test_estimate_and_generate_creates_assets(client):
    pid, _ = _plan(client)
    est = client.get(f"/api/v1/projects/{pid}/estimate", headers=auth()).json()
    assert est["images"] == 7 and est["videoSeconds"] == 10.0 and est["currency"] == "USD"
    job = client.post(f"/api/v1/projects/{pid}/generate", json={"quality": "draft"}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "completed", done
    assert done["result"]["createdAssets"] == 3 + 4 + 2  # portraits + frames + voice lines (mock has no video)
    project = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()
    assert all(c.get("imageUrl") for c in project["memory"]["characters"])
    assert all(s.get("imageUrl") for s in project["memory"]["shots"])
    # media is served
    url = project["memory"]["shots"][0]["imageUrl"]
    assert client.get(url.replace("http://localhost:8000", "")).status_code == 200


def test_generate_twice_reuses_ready_assets(client):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth())
    job2 = client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job2['id']}", headers=auth()).json()["result"]["createdAssets"] == 0


def test_idempotency_key_returns_same_job(client):
    pid, _ = _plan(client)
    h = {**auth(), "Idempotency-Key": "gen-1"}
    a = client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=h).json()
    b = client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=h).json()
    assert a["id"] == b["id"]


def test_regenerate_character_marks_frames_outdated(client):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth())
    project = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()
    elena = next(a for a in project["assets"] if a["type"] == "character_image" and a["ref"] == "1")
    job = client.post(f"/api/v1/assets/{elena['id']}/regenerate", headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    project = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()
    outdated = {a["ref"] for a in project["assets"] if a["type"] == "storyboard_image" and a["status"] == "outdated"}
    assert outdated == {"2", "3"}  # shots featuring Elena
    new = next(a for a in project["assets"] if a["type"] == "character_image" and a["ref"] == "1" and a["status"] == "ready")
    assert new["version"] == 2


def test_edit_story(client):
    pid, _ = _plan(client)
    job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "story", "instruction": "Make it darker"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    story = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["story"]
    assert "Make it darker" in story


def test_render_without_video_needs_review(client):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth())
    job = client.post(f"/api/v1/projects/{pid}/render", json={"format": "16:9", "quality": "1080"}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "needs_review" and "video" in done["error"].lower()


def test_approve_versions(client):
    pid, _ = _plan(client)
    a = client.post(f"/api/v1/projects/{pid}/approve", json={"step": "plan"}, headers=auth()).json()
    b = client.post(f"/api/v1/projects/{pid}/approve", json={"step": "plan", "approved": False}, headers=auth()).json()
    assert (a["version"], b["version"], b["status"]) == (1, 2, "rejected")


def test_cost_confirmation_gate(client, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "COST_CONFIRM_THRESHOLD", 0.01)
    pid, _ = _plan(client)
    assert client.post(f"/api/v1/projects/{pid}/generate", json={"quality": "final"}, headers=auth()).status_code == 402
    assert client.post(f"/api/v1/projects/{pid}/generate", json={"quality": "final", "confirmCost": True}, headers=auth()).status_code == 202


def test_jobs_are_private(client):
    _, job = _plan(client)
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth("intruder@x.io")).status_code == 404


# ---------- real provider adapters (HTTP mocked) ----------

@pytest.mark.asyncio
@respx.mock
async def test_sarvam_story_parses_json_and_retries(monkeypatch):
    from app.config import get_settings
    from app.providers.sarvam import SarvamStory
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    film = '{"title": "Neon Monsoon", "characters": [], "shots": [{"id": "1", "number": 1, "description": "rain"}]}'
    route = respx.post("https://api.sarvam.ai/v1/chat/completions").mock(side_effect=[
        Response(503, text="busy"),
        Response(200, json={"choices": [{"message": {"content": f"<think>planning</think>```json\n{film}\n```"}}], "usage": {"total_tokens": 9}}),
    ])
    from app.providers.base import ProviderError
    s = SarvamStory()
    with pytest.raises(ProviderError) as e:
        await s.plan_film({"prompt": "x"})
    assert e.value.transient
    res = await s.plan_film({"prompt": "x", "teaserSeconds": 30})
    assert res.data["title"] == "Neon Monsoon" and route.call_count == 2
    sent = route.calls[-1].request
    assert sent.headers["Authorization"] == "Bearer k"


@pytest.mark.asyncio
@respx.mock
async def test_sarvam_tts(monkeypatch):
    import base64
    from app.config import get_settings
    from app.providers.sarvam import SarvamTTS
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    route = respx.post("https://api.sarvam.ai/text-to-speech").mock(
        return_value=Response(200, json={"request_id": "r", "audios": [base64.b64encode(b"RIFFdata").decode()]}))
    res = await SarvamTTS().generate_voice("Vanakkam", language="ta")
    assert res.data == b"RIFFdata"
    import json
    body = json.loads(route.calls[0].request.content)
    assert body["language_code"] == "ta-IN" and body["model"] == "bulbul:v3"
    assert route.calls[0].request.headers["api-subscription-key"] == "k"


@pytest.mark.asyncio
@respx.mock
async def test_seedance_submit_and_poll(monkeypatch):
    from app.config import get_settings
    from app.providers.seedance import SeedanceVideo
    s = get_settings()
    monkeypatch.setattr(s, "ATLAS_API_KEY", "k")
    monkeypatch.setattr(s, "PROVIDER_POLL_INTERVAL_SECONDS", 0)
    respx.post("https://api.atlascloud.ai/api/v1/model/generateVideo").mock(return_value=Response(200, json={"data": {"id": "pred1"}}))
    respx.get("https://api.atlascloud.ai/api/v1/model/prediction/pred1").mock(side_effect=[
        Response(200, json={"data": {"status": "processing"}}),
        Response(200, json={"data": {"status": "completed", "outputs": ["https://cdn.example/v.mp4"]}}),
    ])
    res = await SeedanceVideo().generate_video("push in", image_url="https://x/f.png", duration=3, quality="draft", aspect_ratio="16:9")
    assert res.data == "https://cdn.example/v.mp4" and res.cost == pytest.approx(3 * s.COST_PER_VIDEO_SECOND_DRAFT)


@pytest.mark.asyncio
@respx.mock
async def test_openai_image(monkeypatch):
    import base64
    from app.config import get_settings
    from app.providers.openai_images import OpenAIImage
    monkeypatch.setattr(get_settings(), "OPENAI_API_KEY", "k")
    respx.post("https://api.openai.com/v1/images/generations").mock(
        return_value=Response(200, json={"data": [{"b64_json": base64.b64encode(b"\x89PNG").decode()}]}))
    res = await OpenAIImage().generate_image("portrait")
    assert res.data == b"\x89PNG" and res.provider == "openai"


def test_supabase_hs256_token(monkeypatch):
    import time
    import jwt as pyjwt
    from app.auth import decode_token
    from app.config import Settings
    s = Settings(AUTH_MODE="supabase", SUPABASE_URL="https://abc.supabase.co", SUPABASE_JWT_SECRET="secret-at-least-32-characters-long!!")
    claims = {"sub": "user-1", "email": "a@b.co", "aud": "authenticated", "iss": "https://abc.supabase.co/auth/v1", "exp": int(time.time()) + 60}
    tok = pyjwt.encode(claims, s.SUPABASE_JWT_SECRET, algorithm="HS256")
    u = decode_token(tok, s)
    assert (u.id, u.email) == ("user-1", "a@b.co")
    bad = pyjwt.encode({**claims, "iss": "https://evil/auth/v1"}, s.SUPABASE_JWT_SECRET, algorithm="HS256")
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        decode_token(bad, s)


def test_supabase_es256_jwks(monkeypatch):
    import time
    import jwt as pyjwt
    from cryptography.hazmat.primitives.asymmetric import ec
    from app import auth as auth_mod
    from app.config import Settings
    key = ec.generate_private_key(ec.SECP256R1())

    class FakeJWKS:
        def get_signing_key_from_jwt(self, token):
            return type("K", (), {"key": key.public_key()})()

    monkeypatch.setattr(auth_mod, "_jwks_client", lambda url: FakeJWKS())
    s = Settings(AUTH_MODE="supabase", SUPABASE_URL="https://abc.supabase.co")
    tok = pyjwt.encode({"sub": "u2", "aud": "authenticated", "iss": "https://abc.supabase.co/auth/v1", "exp": int(time.time()) + 60},
                       key, algorithm="ES256", headers={"kid": "k1"})
    assert auth_mod.decode_token(tok, s).id == "u2"


def test_render_with_video_clips_uses_ffmpeg(client, monkeypatch, tmp_path):
    """With a video provider connected, generate + render produces a real MP4 teaser."""
    import shutil
    import subprocess
    if not shutil.which("ffmpeg"):
        pytest.skip("ffmpeg not installed")
    clip = tmp_path / "clip.mp4"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x180:rate=24",
                    "-t", "1", "-pix_fmt", "yuv420p", str(clip)], check=True)

    from app.providers.base import ProviderResult, VideoProvider
    from app.services import pipeline, storage

    class FakeVideo(VideoProvider):
        async def generate_video(self, prompt, *, image_url, duration, quality, aspect_ratio):
            url = await storage.save_bytes("provider/clip.mp4", clip.read_bytes())
            return ProviderResult(url, provider="fake-video", cost=0.5)

    monkeypatch.setattr(pipeline, "video_provider", lambda: FakeVideo())
    pid, _ = _plan(client)
    gen = client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth()).json()
    gen = client.get(f"/api/v1/jobs/{gen['id']}", headers=auth()).json()
    assert gen["result"]["videoClips"] == 4 and gen["cost"] >= 2.0
    project = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()
    assert all(s.get("videoUrl") for s in project["memory"]["shots"])

    job = client.post(f"/api/v1/projects/{pid}/render", json={"format": "9:16", "quality": "720"}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "completed", done
    out = client.get(done["result"]["outputUrl"].replace("http://localhost:8000", ""))
    assert out.status_code == 200
    teaser = tmp_path / "teaser.mp4"
    teaser.write_bytes(out.content)
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height",
                            "-of", "csv=p=0", str(teaser)], capture_output=True, text=True, check=True)
    assert probe.stdout.strip() == "720,1280"
