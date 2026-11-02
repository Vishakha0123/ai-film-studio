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


# ---------- workspace: projects, assets, settings ----------

def test_rename_and_delete_project(client):
    pid, _ = _plan(client)
    r = client.patch(f"/api/v1/projects/{pid}", json={"title": "Neon Monsoon"}, headers=auth()).json()
    assert r["title"] == "Neon Monsoon" and r["memory"]["title"] == "Neon Monsoon"
    assert client.patch(f"/api/v1/projects/{pid}", json={"title": "x"}, headers=auth("other@x.io")).status_code == 404
    assert client.delete(f"/api/v1/projects/{pid}", headers=auth("other@x.io")).status_code == 404
    assert client.delete(f"/api/v1/projects/{pid}", headers=auth()).status_code == 204
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).status_code == 404
    assert client.get("/api/v1/projects", headers=auth()).json() == []


def test_project_list_has_thumbnail_and_counts(client):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth())
    [summary] = client.get("/api/v1/projects", headers=auth()).json()
    assert summary["assetCount"] == 9
    assert summary["thumbnailUrl"].endswith("storyboard_image/1-v1.svg")
    assert summary["logline"].startswith("A grieving composer")


def test_list_assets_filters_and_privacy(client):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={}, headers=auth())
    all_assets = client.get("/api/v1/assets", headers=auth()).json()
    assert len(all_assets) == 9 and all_assets[0]["projectTitle"] == "Echoes of the Forgotten"
    voices = client.get("/api/v1/assets", params={"type": "voice", "project_id": pid}, headers=auth()).json()
    assert len(voices) == 2 and all(a["type"] == "voice" for a in voices)
    assert client.get("/api/v1/assets", headers=auth("other@x.io")).json() == []


def test_preferences_round_trip(client):
    me = client.get("/api/v1/me", headers=auth()).json()
    assert me["preferences"] == {"displayName": "", "language": "en", "teaserSeconds": 30, "aspectRatio": "16:9", "quality": "draft",
                                 "visualStyle": "Dark Cinema", "filmLength": "medium", "voice": "shubh", "voicePace": 1.0}
    prefs = {"displayName": "Sheerap", "language": "ta", "teaserSeconds": 45, "aspectRatio": "9:16", "quality": "final",
             "visualStyle": "Anime", "filmLength": "short", "voice": "priya", "voicePace": 1.25}
    assert client.patch("/api/v1/me", json=prefs, headers=auth()).json()["preferences"] == prefs
    assert client.get("/api/v1/me", headers=auth()).json()["preferences"] == prefs
    assert client.patch("/api/v1/me", json={**prefs, "teaserSeconds": 500}, headers=auth()).status_code == 422
    assert client.patch("/api/v1/me", json={**prefs, "voice": "nobody"}, headers=auth()).status_code == 422
    assert client.patch("/api/v1/me", json={**prefs, "voicePace": 3}, headers=auth()).status_code == 422
    assert client.patch("/api/v1/me", json={**prefs, "filmLength": "epic"}, headers=auth()).status_code == 422


def test_new_films_use_writing_defaults(client, monkeypatch):
    from app.providers.mock import MockStory
    seen = {}
    original = MockStory.plan_film

    async def spy(self, brief):
        seen.update(brief)
        return await original(self, brief)
    monkeypatch.setattr(MockStory, "plan_film", spy)
    me = client.get("/api/v1/me", headers=auth()).json()["preferences"]
    client.patch("/api/v1/me", json={**me, "visualStyle": "Anime", "filmLength": "long"}, headers=auth())
    pid, _ = _plan(client)
    assert seen["filmLength"] == "long"
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["visualStyle"] == "Anime"


def test_long_films_ask_for_more_scenes():
    from app.prompts import render
    from app.providers.sarvam import SCENE_COUNTS
    assert SCENE_COUNTS == {"short": 3, "medium": 5, "long": 8}
    assert "exactly 8 scenes" in render("plan_film.v2", scene_count=8)


def test_voice_preview(client):
    r = client.post("/api/v1/voice/preview", json={"voice": "kavya", "pace": 1.5, "language": "ta"}, headers=auth())
    assert r.status_code == 200 and r.headers["content-type"] == "audio/wav" and r.content[:4] == b"RIFF"
    assert client.post("/api/v1/voice/preview", json={"voice": "nobody"}, headers=auth()).status_code == 422
    assert client.post("/api/v1/voice/preview", json={"voice": "kavya"}).status_code == 401


def test_export_my_data(client):
    pid, _ = _plan(client)
    client.post("/api/v1/projects", json={"title": "Someone else's"}, headers=auth("other@x.io"))
    r = client.get("/api/v1/me/export", headers=auth())
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    data = r.json()
    assert data["account"]["preferences"]["voice"] == "shubh"
    assert [f["id"] for f in data["films"]] == [pid]
    assert data["films"][0]["memory"]["screenplay"]


def test_delete_my_account(client):
    pid, _ = _plan(client)
    other = client.post("/api/v1/projects", json={"title": "Keep"}, headers=auth("other@x.io")).json()
    me = client.get("/api/v1/me", headers=auth()).json()["preferences"]
    client.patch("/api/v1/me", json={**me, "displayName": "Gone"}, headers=auth())
    assert client.delete("/api/v1/me", headers=auth()).status_code == 204
    assert client.get("/api/v1/projects", headers=auth()).json() == []
    assert client.get("/api/v1/me", headers=auth()).json()["preferences"]["displayName"] == ""  # fresh account
    assert client.get(f"/api/v1/projects/{other['id']}", headers=auth("other@x.io")).status_code == 200


def test_timestamps_are_utc(client):
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    assert p["createdAt"].endswith("Z") or p["createdAt"].endswith("+00:00")
    [s] = client.get("/api/v1/projects", headers=auth()).json()
    assert s["updatedAt"].endswith("Z") or s["updatedAt"].endswith("+00:00")


# ---------- attachments & voice ----------

def _pdf_bytes(text: str) -> bytes:
    """Minimal single-page PDF with one line of text."""
    content = f"BT /F1 18 Tf 50 700 Td ({text}) Tj ET".encode()
    objs = [b"<< /Type /Catalog /Pages 2 0 R >>", b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream",
            b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    out, offsets = b"%PDF-1.4\n", []
    for i, o in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + o + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
    return out + b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)


def _docx_bytes(lines: list[str]) -> bytes:
    import io, zipfile
    body = "".join(f"<w:p><w:r><w:t>{l}</w:t></w:r></w:p>" for l in lines)
    xml = f'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{body}</w:body></w:document>'
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("word/document.xml", xml)
    return buf.getvalue()


def test_upload_documents_extracts_text(client):
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    url = f"/api/v1/projects/{p['id']}/documents"
    txt = client.post(url, files={"file": ("idea.md", b"# Monsoon\nMeera waits at Chennai Central.", "text/markdown")}, headers=auth())
    assert txt.status_code == 201 and txt.json()["type"] == "text" and "Meera" in txt.json()["preview"]
    pdf = client.post(url, files={"file": ("script.pdf", _pdf_bytes("INT. CHENNAI CENTRAL - NIGHT"), "application/pdf")}, headers=auth()).json()
    assert pdf["type"] == "pdf" and "CHENNAI CENTRAL" in pdf["preview"] and pdf["sourceReference"] == "1 page"
    docx = client.post(url, files={"file": ("lyrics.docx", _docx_bytes(["Mazhai varum", "Un ninaivu"]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}, headers=auth()).json()
    assert docx["type"] == "docx" and "Mazhai varum" in docx["preview"]
    png = client.post(url, files={"file": ("ref.png", b"\x89PNG\r\n\x1a\n" + b"0" * 64, "image/png")}, headers=auth()).json()
    assert png["type"] == "image" and png["preview"] == ""
    assert client.get(png["fileUrl"].replace("http://localhost:8000", "")).status_code == 200
    assert len(client.get(url, headers=auth()).json()) == 4
    assert client.delete(f"/api/v1/documents/{png['id']}", headers=auth()).status_code == 204
    assert len(client.get(url, headers=auth()).json()) == 3


def test_upload_rejects_bad_files(client):
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    url = f"/api/v1/projects/{p['id']}/documents"
    assert client.post(url, files={"file": ("virus.exe", b"MZ...", "application/octet-stream")}, headers=auth()).status_code == 422
    fake = client.post(url, files={"file": ("fake.pdf", b"not a pdf", "application/pdf")}, headers=auth())
    assert fake.status_code == 422 and "match" in fake.json()["detail"]
    big = client.post(url, files={"file": ("big.txt", b"a" * (10 * 1024 * 1024 + 1), "text/plain")}, headers=auth())
    assert big.status_code == 422
    assert client.post(url, files={"file": ("a.txt", b"hi", "text/plain")}, headers=auth("other@x.io")).status_code == 404


def test_plan_uses_attached_source_material(client, monkeypatch):
    from app.providers.mock import MockStory
    seen = {}
    orig = MockStory.plan_film

    async def spy(self, brief):
        seen.update(brief)
        return await orig(self, brief)

    monkeypatch.setattr(MockStory, "plan_film", spy)
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/documents", files={"file": ("story.txt", b"Meera and Arjun meet in the rain.", "text/plain")}, headers=auth())
    job = client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth()).json()  # no typed prompt needed
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert "Meera and Arjun meet in the rain." in seen["sourceMaterial"] and "story.txt" in seen["sourceMaterial"]


def test_transcribe_mock_is_not_connected(client):
    r = client.post("/api/v1/transcribe", files={"audio": ("v.webm", b"\x1aE\xdf\xa3", "audio/webm")}, data={"language": "ta"}, headers=auth())
    assert r.status_code == 501
    assert client.get("/health").json()["providers"]["stt"] == "mock"


@pytest.mark.asyncio
@respx.mock
async def test_sarvam_stt(monkeypatch):
    from app.config import get_settings
    from app.providers.sarvam import SarvamSTT
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    route = respx.post("https://api.sarvam.ai/speech-to-text").mock(return_value=Response(200, json={"request_id": "r", "transcript": " மழை பெய்கிறது ", "language_code": "ta-IN"}))
    res = await SarvamSTT().transcribe(b"audio", filename="voice.webm", language="ta")
    assert res.data == "மழை பெய்கிறது"
    req = route.calls[0].request
    assert req.headers["api-subscription-key"] == "k"
    assert b'name="language_code"' in req.content and b"ta-IN" in req.content and b"saaras:v3" in req.content


def test_transcribe_with_sarvam(client, monkeypatch):
    from app.config import get_settings
    from app.providers.base import ProviderResult
    from app.providers.sarvam import SarvamSTT
    monkeypatch.setattr(get_settings(), "STT_PROVIDER", "sarvam")

    async def fake(self, audio, *, filename, language="en-IN"):
        assert language == "hi" and filename == "v.webm"
        return ProviderResult("नमस्ते", provider="sarvam")

    monkeypatch.setattr(SarvamSTT, "transcribe", fake)
    r = client.post("/api/v1/transcribe", files={"audio": ("v.webm", b"abc", "audio/webm")}, data={"language": "hi"}, headers=auth())
    assert r.status_code == 200 and r.json() == {"text": "नमस्ते", "provider": "sarvam"}


# ---------- Film language ----------

@pytest.mark.asyncio
@respx.mock
async def test_sarvam_plan_writes_in_film_language_whatever_the_prompt_language(monkeypatch):
    import json as _json
    from app.config import get_settings
    from app.providers.sarvam import SarvamStory
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    route = respx.post("https://api.sarvam.ai/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": '{"title": "மழை"}'}}]}))
    await SarvamStory().plan_film({"prompt": "A love story in the monsoon", "language": "ta", "teaserSeconds": 30})
    prompt = _json.loads(route.calls[-1].request.content)["messages"][0]["content"]
    assert "Tamil (தமிழ், ta)" in prompt
    assert "Do this even when" in prompt
    route.mock(return_value=Response(200, json={"choices": [{"message": {"content": '{"value": "कहानी"}'}}]}))
    await SarvamStory().edit({"title": "x"}, "story", "make it darker", language="hi")
    prompt = _json.loads(route.calls[-1].request.content)["messages"][0]["content"]
    assert "Hindi (हिन्दी, hi)" in prompt


def test_plan_passes_project_language_to_story_model(client, monkeypatch):
    from app.providers.mock import MockStory
    seen = {}
    orig = MockStory.plan_film

    async def spy(self, brief):
        seen.update(brief)
        return await orig(self, brief)

    monkeypatch.setattr(MockStory, "plan_film", spy)
    p = client.post("/api/v1/projects", json={"genres": ["Drama"], "language": "te"}, headers=auth()).json()
    job = client.post(f"/api/v1/projects/{p['id']}/plan", json={"prompt": "Two brothers run a ferry"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert seen["language"] == "te" and seen["prompt"] == "Two brothers run a ferry"


def test_language_version_translates_without_retyping_and_keeps_original(client):
    pid, job = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={"confirmCost": True}, headers=auth())
    original = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()

    r = client.post(f"/api/v1/projects/{pid}/versions", json={"language": "ta"}, headers=auth())
    assert r.status_code == 202, r.text
    body = r.json()
    vid = body["project"]["id"]
    assert vid != pid and body["project"]["language"] == "ta" and body["job"]["task"] == "translate"
    assert client.get(f"/api/v1/jobs/{body['job']['id']}", headers=auth()).json()["status"] == "completed"

    version = client.get(f"/api/v1/projects/{vid}", headers=auth()).json()
    assert version["title"] == f"{original['title']} (தமிழ்)"  # mock marks the title; Sarvam translates every field
    assert version["brief"]["prompt"] == original["brief"]["prompt"]  # the idea carries over — no retyping
    assert version["brief"]["language"] == "ta" and version["brief"]["versionOf"] == pid
    assert len(version["memory"]["characters"]) == len(original["memory"]["characters"])
    # pictures carry over (no words in them); voice lines don't
    types = {a["type"] for a in version["assets"]}
    assert "character_image" in types and "storyboard_image" in types and "voice" not in types
    assert version["memory"]["shots"][0]["imageUrl"] == original["memory"]["shots"][0]["imageUrl"]
    # the original is untouched
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["title"] == original["title"]
    assert len(client.get("/api/v1/projects", headers=auth()).json()) == 2


def test_language_version_rejections(client):
    p = client.post("/api/v1/projects", json={"language": "en"}, headers=auth()).json()
    assert client.post(f"/api/v1/projects/{p['id']}/versions", json={"language": "ta"}, headers=auth()).status_code == 409
    pid, _ = _plan(client)
    assert client.post(f"/api/v1/projects/{pid}/versions", json={"language": "en"}, headers=auth()).status_code == 400
    assert client.post(f"/api/v1/projects/{pid}/versions", json={"language": "xx"}, headers=auth()).status_code == 400
    assert client.post(f"/api/v1/projects/{pid}/versions", json={"language": "ta"}, headers=auth("other@x.io")).status_code == 404


def test_translation_that_drops_shots_needs_review(client, monkeypatch):
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory

    async def lossy(self, memory, language):
        return ProviderResult({**memory, "shots": memory["shots"][:1]}, provider="mock", model="x")

    monkeypatch.setattr(MockStory, "translate_film", lossy)
    pid, _ = _plan(client)
    body = client.post(f"/api/v1/projects/{pid}/versions", json={"language": "hi"}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{body['job']['id']}", headers=auth()).json()
    assert done["status"] == "needs_review" and "number of shots" in done["error"]


@pytest.mark.asyncio
@respx.mock
async def test_sarvam_translate_film(monkeypatch):
    import json as _json
    from app.config import get_settings
    from app.providers.sarvam import SarvamStory
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    route = respx.post("https://api.sarvam.ai/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": '{"title": "मौन सिम्फनी"}'}}]}))
    res = await SarvamStory().translate_film({"title": "Silent Symphony"}, "hi")
    assert res.data["title"] == "मौन सिम्फनी"
    prompt = _json.loads(route.calls[-1].request.content)["messages"][0]["content"]
    assert "Hindi (हिन्दी, hi)" in prompt and "Silent Symphony" in prompt


@pytest.mark.asyncio
@respx.mock
async def test_sarvam_cut_off_reply_is_retried_without_thinking(monkeypatch):
    """Gujarati/Tamil films are long: a reply cut off mid-thinking used to fail with 'No JSON object'."""
    import json as _json
    from app.config import get_settings
    from app.providers.sarvam import SarvamStory
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    route = respx.post("https://api.sarvam.ai/v1/chat/completions").mock(side_effect=[
        Response(200, json={"choices": [{"finish_reason": "length", "message": {"content": "<think>The user wants a Gujarati fantasy film. Let me plan the characters"}}],
                            "usage": {"total_tokens": 16000}}),
        Response(200, json={"choices": [{"finish_reason": "stop", "message": {"content": '{"title": "પ્રકાશનું બીજ"}'}}],
                            "usage": {"total_tokens": 9000}}),
    ])
    res = await SarvamStory().plan_film({"prompt": "Fantasy film", "language": "gu", "teaserSeconds": 30})
    assert res.data["title"] == "પ્રકાશનું બીજ"
    first, second = (_json.loads(c.request.content) for c in route.calls)
    assert first["max_tokens"] == 16000 and first["reasoning_effort"] == "low"
    assert second["max_tokens"] == 32000 and second["reasoning_effort"] is None
    assert res.usage["total_tokens"] == 25000


@pytest.mark.asyncio
@respx.mock
async def test_sarvam_still_too_long_gives_a_clear_message(monkeypatch):
    from app.config import get_settings
    from app.providers.base import ProviderError
    from app.providers.sarvam import SarvamStory
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    cut = Response(200, json={"choices": [{"finish_reason": "length", "message": {"content": '{"title": "x", "story": "unfinish'}}]})
    respx.post("https://api.sarvam.ai/v1/chat/completions").mock(side_effect=[cut, cut])
    with pytest.raises(ProviderError) as e:
        await SarvamStory().plan_film({"prompt": "x", "language": "ta"})
    assert "too long" in str(e.value) and not e.value.transient


def test_extract_json_ignores_unclosed_thinking():
    from app.providers._json import extract_json
    assert extract_json('<think>planning…</think>{"a": 1}') == {"a": 1}
    with pytest.raises(ValueError):
        extract_json("<think>still thinking about {the plot")


# ---------- Lyrics ----------

def test_plan_writes_the_theme_song(client):
    pid, _ = _plan(client)
    lyrics = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["lyrics"]
    assert lyrics["title"] and lyrics["verse"] and lyrics["preChorus"] and lyrics["chorus"] and lyrics["bridge"]


def test_lyrics_can_be_edited_and_travel_with_language_versions(client):
    pid, _ = _plan(client)
    job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "lyrics", "instruction": "Improve the rhyme"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    lyrics = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["lyrics"]
    assert "[Revised: Improve the rhyme]" in lyrics["verse"]
    body = client.post(f"/api/v1/projects/{pid}/versions", json={"language": "gu"}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{body['job']['id']}", headers=auth())
    version = client.get(f"/api/v1/projects/{body['project']['id']}", headers=auth()).json()
    assert version["memory"]["lyrics"]["chorus"] == lyrics["chorus"]  # mock keeps the words; Sarvam translates them


def test_old_film_without_lyrics_can_get_a_song(client):
    pid, _ = _plan(client)
    from app.db import SessionLocal
    from app.models import Project
    with SessionLocal() as db:
        p = db.get(Project, pid)
        p.memory = {k: v for k, v in p.memory.items() if k != "lyrics"}
        db.commit()
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"].get("lyrics") is None
    job = client.post(f"/api/v1/projects/{pid}/transform", json={"target": "lyrics", "instruction": "Write the theme song"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["lyrics"]["chorus"]


def test_messy_model_json_still_makes_a_film(client, monkeypatch):
    """Real story models write age 16 (number), null fields, numbers in Tamil digits, translated audio types."""
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory

    async def messy(self, brief):
        return ProviderResult({
            "title": "ஒளியின் விதை", "genre": None, "logline": "மீரா…",
            "characters": [{"id": 1, "name": "மீரா", "age": 16, "role": None}, {"name": "காளி", "age": "நூறு"}],
            "scenes": [{"id": 1, "number": "௧", "location": "காடு", "characters": "மீரா, காளி", "duration": 3}],
            "shots": [{"number": 1, "duration": 2.5, "characters": ["மீரா"], "camera": None, "description": "மரம்"}],
            "audioTracks": [{"type": "இசை", "name": "தீம்", "volume": "80"}, {"type": "Sound Effects", "name": "காற்று"}],
            "dialogue": [{"character": "மீரா", "text": "நான் கேட்கிறேன்", "tone": None}],
            "lyrics": {"title": "விதை", "verse": "…", "chorus": "…"},
        }, provider="mock", model="messy")

    monkeypatch.setattr(MockStory, "plan_film", messy)
    pid, job = _plan(client)
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "completed", done["error"]
    m = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]
    assert m["characters"][0]["age"] == "16" and m["characters"][1]["id"] == "2"
    assert m["scenes"][0]["number"] == 1 and m["scenes"][0]["characters"] == ["மீரா", "காளி"]
    assert m["shots"][0]["duration"] == "2.5" and m["shots"][0]["characters"] == "மீரா" and m["shots"][0]["id"] == "1"
    assert [t["type"] for t in m["audioTracks"]] == ["music", "sfx"] and m["audioTracks"][0]["volume"] == 80


def test_unusable_plan_says_which_fields(client, monkeypatch):
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory

    async def broken(self, brief):
        return ProviderResult({"characters": [{"age": "16"}]}, provider="mock", model="broken")

    monkeypatch.setattr(MockStory, "plan_film", broken)
    _, job = _plan(client)
    err = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["error"]
    assert "title missing" in err and "characters.0.name missing" in err


def test_bulk_delete_projects(client):
    a, _ = _plan(client)
    b, _ = _plan(client)
    c = client.post("/api/v1/projects", json={}, headers=auth()).json()["id"]
    theirs = client.post("/api/v1/projects", json={}, headers=auth("other@x.io")).json()["id"]
    client.post(f"/api/v1/projects/{a}/generate", json={"confirmCost": True}, headers=auth())

    r = client.post("/api/v1/projects/bulk-delete", json={"ids": [a, b, theirs, "nope", a]}, headers=auth())
    assert r.status_code == 200, r.text
    assert r.json() == {"deleted": [a, b], "notFound": [theirs, "nope"]}
    assert [p["id"] for p in client.get("/api/v1/projects", headers=auth()).json()] == [c]
    assert client.get(f"/api/v1/projects/{theirs}", headers=auth("other@x.io")).status_code == 200  # not yours: untouched
    assert client.get("/api/v1/assets", headers=auth()).json() == []  # assets went with the films
    assert client.post("/api/v1/projects/bulk-delete", json={"ids": []}, headers=auth()).status_code == 422


# ---------- Characters ----------

def test_add_edit_remove_character_by_hand(client):
    pid, _ = _plan(client)
    before = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"]
    r = client.post(f"/api/v1/projects/{pid}/characters", json={"name": "Sundar", "age": "12", "role": "Tea boy", "personality": "Curious"}, headers=auth())
    assert r.status_code == 201, r.text
    chars = r.json()["memory"]["characters"]
    new = chars[-1]
    assert len(chars) == len(before) + 1 and new["name"] == "Sundar" and new["id"] == str(len(before) + 1)

    client.post(f"/api/v1/projects/{pid}/generate", json={"confirmCost": True}, headers=auth())
    first = before[0]["id"]
    r = client.patch(f"/api/v1/projects/{pid}/characters/{first}", json={"appearance": "Silver hair, red sari"}, headers=auth())
    assert r.status_code == 200
    p = r.json()
    assert next(c for c in p["memory"]["characters"] if c["id"] == first)["appearance"] == "Silver hair, red sari"
    portrait = next(a for a in p["assets"] if a["type"] == "character_image" and a["ref"] == first)
    assert portrait["status"] == "outdated"  # new look → portrait needs redrawing

    r = client.delete(f"/api/v1/projects/{pid}/characters/{new['id']}", headers=auth())
    assert [c["name"] for c in r.json()["memory"]["characters"]] == [c["name"] for c in before]


def test_character_endpoints_validate(client):
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    assert client.post(f"/api/v1/projects/{p['id']}/characters", json={"name": "X"}, headers=auth()).status_code == 409
    pid, _ = _plan(client)
    assert client.post(f"/api/v1/projects/{pid}/characters", json={"role": "no name"}, headers=auth()).status_code == 422
    assert client.patch(f"/api/v1/projects/{pid}/characters/99", json={"name": "Y"}, headers=auth()).status_code == 404
    assert client.patch(f"/api/v1/projects/{pid}/characters/1", json={"name": " "}, headers=auth()).status_code == 422
    assert client.delete(f"/api/v1/projects/{pid}/characters/1", headers=auth("other@x.io")).status_code == 404


def test_ai_adds_and_rewrites_a_character(client):
    pid, _ = _plan(client)
    n = len(client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"])
    job = client.post(f"/api/v1/projects/{pid}/transform", json={"target": "characters",
                      "instruction": "Add one new character: Gajaraj, a brass clockwork elephant. Write all fields."}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    chars = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"]
    assert len(chars) == n + 1 and chars[-1]["name"] == "Gajaraj"
    job = client.post(f"/api/v1/projects/{pid}/transform", json={"target": "characters",
                      "instruction": 'Rewrite only the character with id "1" with a fresh personality.'}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=auth())
    chars = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"]
    assert "[Revised:" in chars[0]["personality"] and len(chars) == n + 1


# ---------- Hand edits, visual style, AI actions on screenplay / dialogue / shots ----------

def test_patch_memory_saves_edits_and_marks_only_changed_frames(client):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={"confirmCost": True}, headers=auth())
    m = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]
    shots = m["shots"]
    shots[1] = {**shots[1], "camera": "Close-up", "movement": "Dolly in"}
    r = client.patch(f"/api/v1/projects/{pid}/memory", json={"shots": shots,
                     "dialogue": [{"character": "Elena", "text": "Who's there?", "tone": "Fear"}]}, headers=auth())
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["memory"]["shots"][1]["camera"] == "Close-up" and p["memory"]["dialogue"][0]["text"] == "Who's there?"
    frames = {a["ref"]: a["status"] for a in p["assets"] if a["type"] == "storyboard_image"}
    assert frames[str(shots[1]["number"])] == "outdated"
    assert all(s == "ready" for ref, s in frames.items() if ref != str(shots[1]["number"]))


def test_visual_style_is_saved_used_in_prompts_and_redraws_pictures(client, monkeypatch):
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={"confirmCost": True}, headers=auth())
    p = client.patch(f"/api/v1/projects/{pid}/memory", json={"visualStyle": "Anime"}, headers=auth()).json()
    assert p["memory"]["visualStyle"] == "Anime"
    assert {a["status"] for a in p["assets"] if a["type"] == "storyboard_image"} == {"outdated"}
    assert {a["status"] for a in p["assets"] if a["type"] == "character_image"} == {"ready"}  # photos stay

    from app.providers.mock import MockImage
    prompts = []
    orig = MockImage.generate_image

    async def spy(self, prompt, **kw):
        prompts.append(prompt)
        return await orig(self, prompt, **kw)

    monkeypatch.setattr(MockImage, "generate_image", spy)
    client.post(f"/api/v1/projects/{pid}/generate", json={"confirmCost": True}, headers=auth())
    assert prompts and all("anime style" in pr for pr in prompts)  # storyboard frames follow the style
    client.patch(f"/api/v1/projects/{pid}/memory", json={"visualStyle": "watercolour, soft pastel"}, headers=auth())
    from app.db import SessionLocal
    from app.models import Project
    from app.services.pipeline import style_prompt
    with SessionLocal() as db:
        assert style_prompt(db.get(Project, pid)) == "watercolour, soft pastel"  # Custom = the creator's words


def test_patch_memory_validation(client):
    pid, _ = _plan(client)
    assert client.patch(f"/api/v1/projects/{pid}/memory", json={}, headers=auth()).status_code == 422
    assert client.patch(f"/api/v1/projects/{pid}/memory", json={"title": "x"}, headers=auth()).status_code == 422
    p = client.post("/api/v1/projects", json={}, headers=auth()).json()
    assert client.patch(f"/api/v1/projects/{p['id']}/memory", json={"story": "x"}, headers=auth()).status_code == 409


def test_ai_actions_on_dialogue_and_shots(client):
    pid, _ = _plan(client)
    n = len(client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"])
    for instruction in ("Add 2 more dialogue lines.", "Rewrite only line 1: make it scarier."):
        job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "dialogue", "instruction": instruction}, headers=auth()).json()
        assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    d = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"]
    assert len(d) == n + 1 and "[Revised:" in d[0]["text"] and "[Revised:" not in d[1]["text"]
    job = client.post(f"/api/v1/projects/{pid}/transform", json={"target": "shots", "instruction": 'Rewrite only the shot with id "2".'}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=auth())
    shots = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["shots"]
    assert "[Revised:" in shots[1]["description"] and "[Revised:" not in shots[0]["description"]


# ---------- Speed: scoped edits, small context, no thinking for edits ----------

def _spy_edit(monkeypatch):
    from app.providers.mock import MockStory
    seen = {}
    orig = MockStory.edit

    async def spy(self, memory, target, instruction, **kw):
        seen.update(memory=memory, target=target, instruction=instruction)
        return await orig(self, memory, target, instruction, **kw)

    monkeypatch.setattr(MockStory, "edit", spy)
    return seen


def test_selected_passage_edit_sends_and_changes_only_that_passage(client, monkeypatch):
    seen = _spy_edit(monkeypatch)
    pid, _ = _plan(client)
    script = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["screenplay"]
    passage = script.split("\n\n")[2]
    job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "screenplay", "instruction": "Shorten it.", "passage": passage}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert seen["memory"]["screenplay"] == passage  # the model saw only the passage, not the whole script
    new = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["screenplay"]
    assert new.count("[Revised:") == 1 and new.startswith(script.split(passage)[0])  # everything before it untouched


def test_single_item_edit_sends_one_item_and_splices_it_back(client, monkeypatch):
    seen = _spy_edit(monkeypatch)
    pid, _ = _plan(client)
    before = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["shots"]
    job = client.post(f"/api/v1/projects/{pid}/transform", json={"target": "shots", "instruction": "Rewrite this shot.", "item": before[1]["id"]}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=auth())
    assert len(seen["memory"]["shots"]) == 1
    after = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["shots"]
    assert len(after) == len(before) and "[Revised:" in after[1]["description"]
    assert [s["description"] for i, s in enumerate(after) if i != 1] == [s["description"] for i, s in enumerate(before) if i != 1]
    # "Add alternatives" for one line → new items land right after it
    d = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"]
    job = client.post(f"/api/v1/projects/{pid}/continue", json={"target": "dialogue", "instruction": "Add 1 alternative of this line.", "item": "1"}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=auth())
    d2 = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"]
    assert len(d2) == len(d) + 1 and d2[0] == d[0] and d2[2:] == d[1:] and "[New line" in d2[1]["text"]


def test_edit_context_leaves_out_the_screenplay_unless_editing_it(client, monkeypatch):
    seen = _spy_edit(monkeypatch)
    pid, _ = _plan(client)
    job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "dialogue", "instruction": "Make it scarier."}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=auth())
    assert "screenplay" not in seen["memory"] and "shots" not in seen["memory"]
    assert seen["memory"]["characters"] and seen["memory"]["title"]


@pytest.mark.asyncio
@respx.mock
async def test_sarvam_edits_skip_thinking_but_planning_keeps_it(monkeypatch):
    import json as _json
    from app.config import get_settings
    from app.providers.sarvam import SarvamStory
    monkeypatch.setattr(get_settings(), "SARVAM_API_KEY", "k")
    route = respx.post("https://api.sarvam.ai/v1/chat/completions").mock(
        return_value=Response(200, json={"choices": [{"message": {"content": '{"value": "x", "title": "t"}'}}]}))
    await SarvamStory().edit({"story": "a"}, "story", "shorter")
    assert _json.loads(route.calls[-1].request.content)["reasoning_effort"] is None
    await SarvamStory().translate_film({"title": "a"}, "ta")
    assert _json.loads(route.calls[-1].request.content)["reasoning_effort"] is None
    await SarvamStory().plan_film({"prompt": "x"})
    assert _json.loads(route.calls[-1].request.content)["reasoning_effort"] == "low"


# ---------- Dialogue per scene ----------

def test_dialogue_reply_for_one_scene_in_other_shapes_is_accepted_and_merged(client, monkeypatch):
    """The real failure: "give me the second scene dialogue" → the model answered {"scene": 2, "lines": [...]}."""
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory
    pid, _ = _plan(client)
    before = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"]

    async def scene_two(self, memory, target, instruction, **kw):
        return ProviderResult({"scene": "2", "lines": [{"speaker": "Pooja", "line": "Who moved my ring light?", "emotion": "Angry"},
                                                       "Bhoot-ji: I prefer the dark."]}, provider="mock", model="x")

    monkeypatch.setattr(MockStory, "edit", scene_two)
    job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "dialogue", "instruction": "give me the second scene dialogue"}, headers=auth()).json()
    done = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()
    assert done["status"] == "completed", done["error"]
    d = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"]
    assert [l["text"] for l in d[: len(before)]] == [l["text"] for l in before]  # nothing lost
    assert d[-2:] == [{"character": "Pooja", "text": "Who moved my ring light?", "tone": "Angry", "scene": 2, "language": "", "subtitle": ""},
                      {"character": "Bhoot-ji", "text": "I prefer the dark.", "tone": "", "scene": 2, "language": "", "subtitle": ""}]


def test_generate_lines_for_a_scene(client):
    pid, _ = _plan(client)
    job = client.post(f"/api/v1/projects/{pid}/continue", json={"target": "dialogue", "instruction": "Write 3 new dialogue lines for scene 3."}, headers=auth()).json()
    client.get(f"/api/v1/jobs/{job['id']}", headers=auth())
    d = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["dialogue"]
    assert d[-1]["scene"] == 3


def test_bad_reply_error_names_the_fields(client, monkeypatch):
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory

    async def bad(self, memory, target, instruction, **kw):
        return ProviderResult([{"character": "X"}], provider="mock", model="x")

    monkeypatch.setattr(MockStory, "edit", bad)
    pid, _ = _plan(client)
    job = client.post(f"/api/v1/projects/{pid}/improve", json={"target": "dialogue", "instruction": "x"}, headers=auth()).json()
    err = client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["error"]
    assert "dialogue.0.text missing" in err


def test_first_requests_of_a_new_user_at_the_same_time(client, monkeypatch):
    """Signing in fires two requests at once; both must succeed even though both try to create the user."""
    from sqlalchemy.orm import Session as S
    from app.models import User
    original_commit = S.commit
    state = {"raced": False}

    def racing_commit(self):
        if not state["raced"] and any(isinstance(o, User) for o in self.new):
            state["raced"] = True
            from app.db import SessionLocal
            other = SessionLocal()
            from app.auth import decode_token
            from app.config import get_settings
            other.add(User(id=decode_token("dev:race@x.io", get_settings()).id, email="race@x.io"))
            original_commit(other)
            other.close()
        return original_commit(self)
    monkeypatch.setattr(S, "commit", racing_commit)
    r = client.get("/api/v1/me", headers=auth("race@x.io"))
    assert state["raced"] and r.status_code == 200 and r.json()["email"] == "race@x.io"


def test_script_check_spots_an_english_screenplay_in_a_punjabi_film():
    from app.services.script_check import in_language, wrong_language_fields
    english = "EXT. MUMBAI ROOFTOP - NIGHT\nRain lashes down. ARJUN (55) leaps across a gap between two buildings.\nCUT TO:"
    punjabi = "EXT. ਮੁੰਬਈ ਛੱਤ - ਰਾਤ\nਮੀਂਹ ਜ਼ੋਰ ਨਾਲ ਪੈ ਰਿਹਾ ਹੈ। ਅਰਜੁਨ (55) ਦੋ ਇਮਾਰਤਾਂ ਵਿਚਕਾਰ ਛਾਲ ਮਾਰਦਾ ਹੈ।\nCUT TO:"
    assert not in_language(english, "pa") and in_language(punjabi, "pa")
    assert in_language(english, "en")  # English films aren't checked
    film = {"screenplay": english, "story": "ਇੱਕ ਬਦਲੇ ਦੀ ਕਹਾਣੀ ਜੋ ਮੀਂਹ ਵਿੱਚ ਸ਼ੁਰੂ ਹੁੰਦੀ ਹੈ ਅਤੇ ਖ਼ਤਮ ਹੁੰਦੀ ਹੈ।", "logline": "short"}
    assert wrong_language_fields(film, "pa") == ["screenplay"]


PUNJABI_SCRIPT = "ਬਾਂਦਰਾਂ ਦੀ ਬਾਰਿਸ਼\n\nFADE IN:\n\nEXT. ਮੁੰਬਈ ਛੱਤ - ਰਾਤ\n\nਮੀਂਹ ਜ਼ੋਰ ਨਾਲ ਪੈ ਰਿਹਾ ਹੈ। ਅਰਜੁਨ ਦੋ ਇਮਾਰਤਾਂ ਵਿਚਕਾਰ ਛਾਲ ਮਾਰਦਾ ਹੈ ਅਤੇ ਚਾਕੂ ਕੱਢਦਾ ਹੈ।"


def _translate_screenplay_only(monkeypatch):
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory
    calls = []

    async def translate(self, memory, language):
        calls.append(sorted(memory))
        out = dict(memory)
        if "screenplay" in out:
            out["screenplay"] = PUNJABI_SCRIPT
        return ProviderResult(out, provider="mock", model="echo")
    monkeypatch.setattr(MockStory, "translate_film", translate)
    return calls


def test_plan_puts_an_english_screenplay_into_the_film_language(client, monkeypatch):
    calls = _translate_screenplay_only(monkeypatch)
    p = client.post("/api/v1/projects", json={"genres": ["Action"]}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/brief", json={"prompt": "Revenge in the rain", "language": "pa"}, headers=auth())
    job = client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    memory = client.get(f"/api/v1/projects/{p['id']}", headers=auth()).json()["memory"]
    assert memory["screenplay"] == PUNJABI_SCRIPT
    assert calls and "screenplay" in calls[0] and "shots" not in calls[0]  # only the wrong parts are sent


def test_edit_that_comes_back_in_english_is_put_into_the_film_language(client, monkeypatch):
    p = client.post("/api/v1/projects", json={"genres": ["Action"]}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/brief", json={"prompt": "Revenge in the rain", "language": "pa"}, headers=auth())
    client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth())
    calls = _translate_screenplay_only(monkeypatch)
    job = client.post(f"/api/v1/projects/{p['id']}/improve", json={"target": "screenplay", "instruction": "Add more tension"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert client.get(f"/api/v1/projects/{p['id']}", headers=auth()).json()["memory"]["screenplay"] == PUNJABI_SCRIPT
    assert calls == [["screenplay"]]


def test_english_films_are_never_translated(client, monkeypatch):
    calls = _translate_screenplay_only(monkeypatch)
    _plan(client)
    assert calls == []


def test_chat_is_kept_with_the_film(client):
    pid, _ = _plan(client)
    msgs = [{"id": "1", "role": "user", "content": "A ghost runs a tea stall"},
            {"id": "2", "role": "ai", "content": "Story ready.", "card": "story"}]
    assert client.put(f"/api/v1/projects/{pid}/chat", json={"messages": msgs}, headers=auth()).status_code == 204
    p = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()
    assert p["chat"] == msgs and p["brief"]["prompt"] and "chat" not in p["brief"]
    # saving the brief again doesn't wipe the chat
    client.post(f"/api/v1/projects/{pid}/brief", json={"prompt": "New idea"}, headers=auth())
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["chat"] == msgs
    # only the newest 150 are kept; bad roles are rejected; others can't write it
    many = [{"id": str(i), "role": "user", "content": f"m{i}"} for i in range(200)]
    client.put(f"/api/v1/projects/{pid}/chat", json={"messages": many}, headers=auth())
    kept = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["chat"]
    assert len(kept) == 150 and kept[-1]["content"] == "m199"
    assert client.put(f"/api/v1/projects/{pid}/chat", json={"messages": [{"id": "x", "role": "system", "content": "hi"}]}, headers=auth()).status_code == 422
    assert client.put(f"/api/v1/projects/{pid}/chat", json={"messages": msgs}, headers=auth("other@x.io")).status_code == 404


def test_saving_the_chat_never_wipes_the_film_idea(client):
    """Regression: the chat was saved inside the brief, so a chat save landing during the brief save erased the
    idea ("Add a film idea to the brief before planning")."""
    p = client.post("/api/v1/projects", json={"genres": ["Drama"]}, headers=auth()).json()
    pid = p["id"]
    chat = {"messages": [{"id": "1", "role": "user", "content": "Four generations save a cinema hall"}]}
    client.put(f"/api/v1/projects/{pid}/chat", json=chat, headers=auth())   # chat first…
    client.post(f"/api/v1/projects/{pid}/brief", json={"prompt": "Four generations save a cinema hall"}, headers=auth())
    client.put(f"/api/v1/projects/{pid}/chat", json=chat, headers=auth())   # …and after
    assert client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["brief"]["prompt"] == "Four generations save a cinema hall"
    job = client.post(f"/api/v1/projects/{pid}/plan", json={}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"


def test_plan_uses_the_idea_sent_with_it_even_if_the_brief_is_empty(client):
    pid = client.post("/api/v1/projects", json={"genres": ["Drama"]}, headers=auth()).json()["id"]
    job = client.post(f"/api/v1/projects/{pid}/plan", json={"prompt": "A tailor sews wishes"}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"


def test_language_versions_start_without_the_original_chat(client):
    pid, _ = _plan(client)
    client.put(f"/api/v1/projects/{pid}/chat", json={"messages": [{"id": "1", "role": "user", "content": "hi"}]}, headers=auth())
    v = client.post(f"/api/v1/projects/{pid}/versions", json={"language": "ta"}, headers=auth()).json()
    assert "chat" not in v["project"]["brief"] and v["project"]["chat"] == []


def test_project_jobs_lists_newest_first_and_filters_active(client):
    pid, job = _plan(client)
    jobs = client.get(f"/api/v1/projects/{pid}/jobs", headers=auth()).json()
    assert [j["id"] for j in jobs] == [job["id"]] and jobs[0]["task"] == "plan"
    assert client.get(f"/api/v1/projects/{pid}/jobs", params={"active": "true"}, headers=auth()).json() == []
    assert client.get(f"/api/v1/projects/{pid}/jobs", headers=auth("other@x.io")).status_code == 404


def test_characters_have_a_gender_for_their_portrait(client):
    from app.schemas import Character, normalize_gender
    assert [normalize_gender(v) for v in ("Female", "girl", "F", "महिला", "Male", "boy", "", "robot")] == \
        ["female", "female", "female", "female", "male", "male", "", ""]
    assert Character.model_validate({"name": "Asha", "age": 8, "gender": "Girl"}).gender == "female"
    pid, _ = _plan(client)
    chars = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"]
    assert {c["name"]: c["gender"] for c in chars}["Elena Vasquez"] == "female"
    # set by hand: added and edited characters keep it
    p = client.post(f"/api/v1/projects/{pid}/characters", json={"name": "Chotu", "age": "9", "gender": "male"}, headers=auth()).json()
    chotu = p["memory"]["characters"][-1]
    assert chotu["gender"] == "male" and chotu["age"] == "9"
    p = client.patch(f"/api/v1/projects/{pid}/characters/{chotu['id']}", json={"gender": "female"}, headers=auth()).json()
    assert p["memory"]["characters"][-1]["gender"] == "female"


def test_portrait_prompt_says_girl_or_boy_and_age(client, monkeypatch):
    from app.providers.mock import MockImage
    prompts = []
    original = MockImage.generate_image

    async def spy(self, prompt, **kw):
        prompts.append(prompt)
        return await original(self, prompt, **kw)
    monkeypatch.setattr(MockImage, "generate_image", spy)
    pid, _ = _plan(client)
    client.post(f"/api/v1/projects/{pid}/generate", json={"quality": "draft", "confirmCost": True}, headers=auth())
    elena = next(p for p in prompts if "character named Elena" in p)
    assert elena.startswith("Photorealistic close-up portrait photograph of a young woman, exactly 32 years old")
    assert "real skin texture" in elena and "unique, fictional individual" in elena


# ---------- Photo portraits ----------

photo_negatives: list[str] = []


@pytest.fixture
def photo_portraits(monkeypatch):
    """Turn real portraits on, with the offline mock standing in for the image model; collect the prompts."""
    from app.config import get_settings
    from app.providers.mock import MockImage
    monkeypatch.setattr(get_settings(), "ALLOW_MOCK_PORTRAITS", True)
    prompts = []
    negatives = photo_negatives
    orig = MockImage.generate_image

    async def spy(self, prompt, **kw):
        prompts.append((prompt, kw.get("size")))
        negatives.append(kw.get("negative_prompt", ""))
        return await orig(self, prompt, **kw)
    monkeypatch.setattr(MockImage, "generate_image", spy)
    return prompts


def _portrait_versions(client, pid):
    assets = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["assets"]
    return {a["ref"]: a["version"] for a in assets if a["type"] == "character_image"}


def test_portrait_age_bands_match_the_app():
    from app.services.portraits import age_band
    assert [age_band(a) for a in ("7", "15", "26", "44", "68", "", "teenager", "elderly", "੫੫", "early 30s")] == \
        ["child", "teen", "young", "adult", "senior", "adult", "teen", "senior", "senior", "young"]


def test_without_an_image_model_portraits_explain_how_to_turn_them_on(client):
    pid, _ = _plan(client)
    assert _portrait_versions(client, pid) == {}  # nothing automatic with the mock
    r = client.post(f"/api/v1/projects/{pid}/portraits", json={}, headers=auth())
    assert r.status_code == 409 and "IMAGE_PROVIDER=openai" in r.json()["detail"]


def test_a_planned_film_gets_photo_portraits_of_its_cast(client, photo_portraits):
    pid, _ = _plan(client)
    assert _portrait_versions(client, pid) == {"1": 1, "2": 1, "3": 1}
    jobs = client.get(f"/api/v1/projects/{pid}/jobs", headers=auth()).json()
    assert [j["task"] for j in jobs] == ["portraits", "plan"] and jobs[0]["status"] == "completed"
    prompt, size = photo_portraits[0]
    assert prompt.startswith("Photorealistic close-up portrait photograph of a young woman, exactly 32 years old, "
                             "a fictional character named Elena") and size == "1024x1536"
    chars = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"]
    assert all(c.get("imageUrl") for c in chars)


def test_adding_or_changing_a_character_makes_a_new_photo(client, photo_portraits):
    pid, _ = _plan(client)
    p = client.post(f"/api/v1/projects/{pid}/characters", json={"name": "Pinky", "age": "8", "gender": "female"}, headers=auth()).json()
    new_id = p["memory"]["characters"][-1]["id"]
    assert _portrait_versions(client, pid)[new_id] == 1
    assert any(pr.startswith("Photorealistic close-up portrait photograph of a little girl, exactly 8 years old, "
                             "a fictional character named Pinky") for pr, _ in photo_portraits)
    # older → new photo; a role change alone keeps the photo
    client.patch(f"/api/v1/projects/{pid}/characters/{new_id}", json={"age": "70"}, headers=auth())
    assert _portrait_versions(client, pid)[new_id] == 2
    assert photo_portraits[-1][0].startswith("Photorealistic close-up portrait photograph of an elderly woman, exactly 70 years old")
    client.patch(f"/api/v1/projects/{pid}/characters/{new_id}", json={"role": "Village elder"}, headers=auth())
    assert _portrait_versions(client, pid)[new_id] == 2


def test_new_photo_for_one_character_on_request(client, photo_portraits):
    pid, _ = _plan(client)
    job = client.post(f"/api/v1/projects/{pid}/portraits", json={"characterIds": ["2"]}, headers=auth()).json()
    assert client.get(f"/api/v1/jobs/{job['id']}", headers=auth()).json()["status"] == "completed"
    assert _portrait_versions(client, pid) == {"1": 1, "2": 2, "3": 1}
    assert client.post(f"/api/v1/projects/{pid}/portraits", json={"characterIds": ["99"]}, headers=auth()).status_code == 404


def test_ai_character_edit_only_rephotographs_the_changed_character(client, photo_portraits):
    pid, _ = _plan(client)
    # mock edit marks the targeted character's personality only → no look change → no new photos
    client.post(f"/api/v1/projects/{pid}/transform", json={"target": "characters", "instruction": 'Rewrite only the character with id "2": braver', "item": "2"}, headers=auth())
    assert _portrait_versions(client, pid) == {"1": 1, "2": 1, "3": 1}
    # a look change through the AI → only that character gets a new photo
    from app.providers.base import ProviderResult
    from app.providers.mock import MockStory

    async def older(self, memory, target, instruction, *, language="en"):
        chars = [dict(c) for c in memory["characters"]]
        chars[0]["age"] = "80"
        return ProviderResult(chars[:1], provider="mock", model="echo")
    import pytest as _pt
    mp = _pt.MonkeyPatch()
    mp.setattr(MockStory, "edit", older)
    try:
        client.post(f"/api/v1/projects/{pid}/transform", json={"target": "characters", "instruction": "Make Elena 80", "item": "1"}, headers=auth())
    finally:
        mp.undo()
    assert _portrait_versions(client, pid) == {"1": 2, "2": 1, "3": 1}


def test_paati_prompt_keeps_her_details_and_asks_for_a_real_photograph(client, photo_portraits):
    photo_negatives.clear()
    pid, _ = _plan(client)
    paati = {"name": "Paati", "age": "78", "gender": "female", "role": "Grandmother who rules the kitchen",
             "appearance": "silver hair in a bun, white cotton saree with a checked border, natural wrinkles, expressive eyes",
             "personality": "Sharp-tongued, loving, secretly sentimental"}
    client.post(f"/api/v1/projects/{pid}/characters", json=paati, headers=auth())
    prompt = photo_portraits[-1][0]
    assert prompt.startswith("Photorealistic close-up portrait photograph of an elderly woman, exactly 78 years old, a fictional character named Paati")
    for detail in ("silver hair in a bun", "white cotton saree with a checked border", "Grandmother who rules the kitchen",
                   "Sharp-tongued, loving", "natural deep wrinkles", "unique, fictional individual", "85mm"):
        assert detail in prompt
    # every portrait goes out with the negative prompt
    assert photo_negatives and all("cartoon" in n and "illustration" in n and "anime" in n and "3D render" in n
                                   and "painting" in n and "avatar" in n for n in photo_negatives)


def test_negative_prompt_is_configurable_and_sent_to_openai_as_avoid(client, monkeypatch):
    from app.config import get_settings
    from app.providers.openai_images import OpenAIImage
    monkeypatch.setattr(get_settings(), "OPENAI_API_KEY", "k")
    monkeypatch.setattr(get_settings(), "PORTRAIT_NEGATIVE_PROMPT", "no cartoons please")
    from app.services.portraits import negative_prompt
    assert negative_prompt() == "no cartoons please"
    import base64
    with respx.mock:
        route = respx.post("https://api.openai.com/v1/images/generations").mock(
            return_value=Response(200, json={"data": [{"b64_json": base64.b64encode(b"img").decode()}]}))
        import asyncio
        asyncio.run(OpenAIImage().generate_image("A portrait", size="1024x1536", negative_prompt="no cartoons please"))
        sent = route.calls[0].request.content.decode()
    assert "A portrait" in sent and "Avoid: no cartoons please." in sent


# ---------- Reference portraits (10 reusable images matched by age and gender) ----------

FAMILY_PROMPT = ("A warm, funny family film set in Chennai. Four generations live in one house: Paati, a 78-year-old "
                 "grandmother who rules the kitchen; Appa, a 45-year-old school teacher; Divya, a 22-year-old college "
                 "student who wants to be a filmmaker; and Arjun, a 9-year-old boy who is always hiding snacks.")


@pytest.fixture
def reference_files():
    """All 10 reference portraits present (tiny stand-in bytes — tests only check matching and serving)."""
    from app.services.reference_portraits import REFERENCES, portraits_dir
    folder = portraits_dir()
    folder.mkdir(parents=True, exist_ok=True)
    paths = []
    for r in REFERENCES:
        path = folder / f"{r.id}.webp"
        path.write_bytes(b"RIFF" + r.id.encode())
        paths.append(path)
    yield folder
    for path in folder.iterdir():
        path.unlink()


def test_prompt_facts_read_names_ages_and_genders():
    from app.services.reference_portraits import prompt_facts
    assert prompt_facts(FAMILY_PROMPT) == {
        "paati": {"age": 78, "gender": "female"}, "appa": {"age": 45, "gender": "male"},
        "divya": {"age": 22, "gender": ""}, "arjun": {"age": 9, "gender": "male"},
    }
    assert prompt_facts("A 70-year-old fisherman named Ravi finds a radio.")["ravi"]["age"] == 70
    assert prompt_facts("Meena (12) and her grandfather Kannan (81) run a tea stall.") == {
        "meena": {"age": 12, "gender": ""}, "kannan": {"age": 81, "gender": "male"}}  # "her grandfather" is ambiguous for Meena
    assert prompt_facts("A ghost haunts a cinema hall.") == {}


def test_age_and_gender_reading():
    from app.services.reference_portraits import gender_from_text, parse_age
    assert [parse_age(v) for v in ("78", "9 years", "early 30s", "੫੫", "elderly", "teenager", "toddler", "", None)] == \
        [78, 9, 30, 55, 72, 15, 3, None, None]
    assert gender_from_text("Grandmother who rules the kitchen") == "female"
    assert gender_from_text("His father's best friend, a retired cop") == "male"
    assert gender_from_text("The film's narrator") == ""


def test_closest_portrait_by_gender_then_age_band_then_age(reference_files):
    from app.services.reference_portraits import choose_reference
    pick = lambda age, gender: choose_reference(age, gender, "x")  # noqa: E731
    assert [pick(a, "female") for a in (3, 9, 13, 17, 22, 34, 45, 54, 60, 78, 95)] == [
        "female-child", "female-child", "female-teen", "female-teen", "female-young", "female-young",
        "female-adult", "female-adult", "female-senior", "female-senior", "female-senior"]
    assert [pick(a, "male") for a in (4, 16, 28, 40, 66)] == ["male-child", "male-teen", "male-young", "male-adult", "male-senior"]
    # no age → an adult; no gender → a stable choice per character (same name, same answer)
    assert pick(None, "male") == "male-adult"
    assert choose_reference(30, "", "Kiran") == choose_reference(30, "", "Kiran") in ("female-young", "male-young")


def test_missing_files_fall_back_to_the_nearest_available(reference_files):
    from app.services.reference_portraits import choose_reference
    (reference_files / "female-senior.webp").unlink()
    assert choose_reference(78, "female", "Paati") == "female-adult"  # nearest woman available
    for f in reference_files.glob("female-*"):
        f.unlink()
    assert choose_reference(78, "female", "Paati") == "male-senior"  # no women at all → nearest age
    for f in reference_files.iterdir():
        f.unlink()
    assert choose_reference(78, "female", "Paati") == ""  # nothing available → no reference, nothing blocked


def _plan_family(client, monkeypatch, wrong_ages=True):
    """The story model returns the family — with Paati's age wrong, to check the prompt's age wins."""
    import copy
    from app.providers.base import ProviderResult
    from app.providers.mock import SAMPLE, MockStory

    async def plan(self, brief):
        film = copy.deepcopy(SAMPLE)
        film["characters"] = [
            {"id": "1", "name": "Paati", "age": "70" if wrong_ages else "78", "role": "Grandmother", "appearance": "silver hair in a bun"},
            {"id": "2", "name": "Appa", "age": "45", "gender": "male", "role": "School teacher"},
            {"id": "3", "name": "Divya", "age": "22", "gender": "female", "role": "Film student"},
            {"id": "4", "name": "Arjun", "age": "", "role": "Snack thief"},
        ]
        return ProviderResult(film, provider="mock", model="sample-film")
    monkeypatch.setattr(MockStory, "plan_film", plan)
    p = client.post("/api/v1/projects", json={"genres": ["Drama"]}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/brief", json={"prompt": FAMILY_PROMPT}, headers=auth())
    client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth())
    return p["id"]


def test_submitting_a_prompt_matches_each_character_to_a_portrait(client, monkeypatch, reference_files):
    pid = _plan_family(client, monkeypatch)
    chars = {c["name"]: c for c in client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"]}
    # the prompt's ages and genders are kept (Paati stays 78 even though the model wrote 70; Arjun gets 9)
    assert {n: (c["age"], c.get("gender")) for n, c in chars.items()} == {
        "Paati": ("78", "female"), "Appa": ("45", "male"), "Divya": ("22", "female"), "Arjun": ("9", "male")}
    assert {n: c["portraitRef"] for n, c in chars.items()} == {
        "Paati": "female-senior", "Appa": "male-adult", "Divya": "female-young", "Arjun": "male-child"}
    assert chars["Paati"]["referenceImageUrl"] == "http://localhost:8000/portraits/female-senior.webp"
    # the portrait is served
    assert client.get("/portraits/female-senior.webp").content == b"RIFFfemale-senior"


def test_editing_age_or_gender_re_matches_the_portrait(client, monkeypatch, reference_files):
    pid = _plan_family(client, monkeypatch, wrong_ages=False)
    client.patch(f"/api/v1/projects/{pid}/characters/4", json={"age": "16"}, headers=auth())
    arjun = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"][3]
    assert (arjun["age"], arjun["portraitRef"]) == ("16", "male-teen")


def test_portraits_appear_on_films_planned_before_the_files_were_added(client, monkeypatch, reference_files):
    for f in reference_files.iterdir():
        f.unlink()
    pid = _plan_family(client, monkeypatch)
    paati = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"][0]
    assert not paati.get("referenceImageUrl")  # nothing to show yet — and planning wasn't blocked
    (reference_files / "female-senior.jpg").write_bytes(b"jpg")
    paati = client.get(f"/api/v1/projects/{pid}", headers=auth()).json()["memory"]["characters"][0]
    assert paati["referenceImageUrl"].endswith("/portraits/female-senior.jpg")


def test_the_matched_portrait_is_sent_to_the_image_model_as_a_reference(client, monkeypatch, reference_files, photo_portraits):
    from app.providers.mock import MockImage
    refs = []
    inner = MockImage.generate_image

    async def spy(self, prompt, **kw):
        refs.append((prompt, kw.get("references")))
        return await inner(self, prompt, **kw)
    monkeypatch.setattr(MockImage, "generate_image", spy)
    _plan_family(client, monkeypatch)
    paati_prompt, paati_refs = next((p, r) for p, r in refs if "named Paati" in p)
    assert paati_refs == [b"RIFFfemale-senior"]
    assert "exactly 78 years old" in paati_prompt and "every detail written above" in paati_prompt


MARATHI_HORROR = ("A horror film set in an abandoned hill-station palace in Ooty. Kamala, a 74-year-old woman who was the "
                  "palace caretaker, knows what happened there; Rohan, a 28-year-old man and ghost-hunting YouTuber, breaks "
                  "in; Nila, a 14-year-old girl, sneaks in after him; and Sundar, a 48-year-old man who is the new owner, "
                  "wants the palace sold.")


def test_film_in_marathi_from_an_english_prompt_gets_the_right_genders(client, monkeypatch, reference_files):
    """The names come back in Devanagari ("कमला"), so they're matched to the prompt by age; Marathi words count too."""
    import copy
    from app.providers.base import ProviderResult
    from app.providers.mock import SAMPLE, MockStory

    async def plan(self, brief):
        film = copy.deepcopy(SAMPLE)
        film["characters"] = [
            {"id": "1", "name": "कमला", "age": "74", "role": "राजवाड्याची जुनी काळजीवाहू आणि रक्षक",
             "personality": "शांत, रहस्यमय आणि भूतकाळातील भयंकर सत्य लपवणारी"},
            {"id": "2", "name": "सुंदर", "age": "48", "role": "राजवाड्याचा नवीन मालक", "personality": "घाबरलेला, लालची"},
            {"id": "3", "name": "रोहन", "age": "28", "role": "भूत शोधणारा यूट्यूबर्स"},
            {"id": "4", "name": "निळा", "age": "१४", "role": "धाडसी मुलगी"},
        ]
        return ProviderResult(film, provider="mock", model="sample-film")
    monkeypatch.setattr(MockStory, "plan_film", plan)
    p = client.post("/api/v1/projects", json={"genres": ["Horror"]}, headers=auth()).json()
    client.post(f"/api/v1/projects/{p['id']}/brief", json={"prompt": MARATHI_HORROR, "language": "mr"}, headers=auth())
    client.post(f"/api/v1/projects/{p['id']}/plan", json={}, headers=auth())
    chars = client.get(f"/api/v1/projects/{p['id']}", headers=auth()).json()["memory"]["characters"]
    assert [(c["name"], c["age"], c["gender"], c["portraitRef"]) for c in chars] == [
        ("कमला", "74", "female", "female-senior"), ("सुंदर", "48", "male", "male-adult"),
        ("रोहन", "28", "male", "male-young"), ("निळा", "14", "female", "female-teen")]
    assert all(c["referenceImageUrl"].endswith(f"/portraits/{c['portraitRef']}.webp") for c in chars)


def test_gender_words_in_indian_languages():
    from app.services.reference_portraits import gender_from_text
    cases = {
        "राजवाड्याची जुनी काळजीवाहू, सत्य लपवणारी": "female",      # Marathi feminine ending
        "भूत शोधणारा यूट्यूबर": "male",                           # Marathi masculine ending
        "गांव की बूढ़ी दादी": "female", "एक छोटा लड़का": "male",       # Hindi
        "கிராமத்து பாட்டி": "female", "மீனவர் தாத்தா": "male",          # Tamil
        "చిన్న అమ్మాయి": "female", "ఊరి తాత": "male",                 # Telugu
        "ಹಳ್ಳಿಯ ಅಜ್ಜಿ": "female", "ಹಳ್ಳಿಯ ಅಜ್ಜ": "male",               # Kannada: ಅಜ್ಜಿ contains ಅಜ್ಜ
        "রাজবাড়ির নতুন মালিক": "",                                   # nothing to go on
    }
    assert {t: gender_from_text(t) for t in cases} == cases


def test_two_characters_with_the_same_age_are_not_guessed_by_age():
    from app.services.reference_portraits import apply_prompt_facts
    memory = {"characters": [{"name": "अ", "age": "30"}, {"name": "ब", "age": "30"}]}
    out = apply_prompt_facts(memory, "Meera, a 30-year-old woman, and Ravi, a 30-year-old man, run a shop.")
    assert [c.get("gender") for c in out["characters"]] == [None, None]


def test_portraits_folder_is_backend_portraits_wherever_the_server_starts(monkeypatch, tmp_path):
    from app.config import get_settings
    from app.services.reference_portraits import BACKEND_DIR, portraits_dir
    monkeypatch.setattr(get_settings(), "REFERENCE_PORTRAITS_DIR", "")
    monkeypatch.chdir(tmp_path)  # started from some other folder
    assert portraits_dir() == BACKEND_DIR / "portraits" and BACKEND_DIR.name == "backend"
    monkeypatch.setattr(get_settings(), "REFERENCE_PORTRAITS_DIR", "my-faces")
    assert portraits_dir() == BACKEND_DIR / "my-faces"
