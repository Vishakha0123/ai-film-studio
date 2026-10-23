"""Long film, assembly: FFmpeg clips per shot, a preview file per scene, and the final film (validated with ffprobe).

Every shot clip is encoded the same way (H.264 yuv420p, 24 fps, the film's frame size, AAC 48 kHz stereo), so scene
files and the final film are joined without re-encoding: a 2-hour film is assembled in seconds, not hours.
"""

import asyncio
import json
import shutil
import subprocess
import tempfile
import textwrap
from io import BytesIO
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import AIJob, Asset, FilmScene, Project
from app.providers.base import ProviderResult
from app.services import storage
from app.services.film_production import frame_size, production_of
from app.services.pipeline import NeedsReview, set_progress, store_asset

FPS, RATE = 24, 48000
VIDEO_OUT = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", str(FPS)]
AUDIO_OUT = ["-c:a", "aac", "-b:a", "128k", "-ar", str(RATE), "-ac", "2"]


class RenderError(Exception):
    pass


def tools() -> tuple[str, str]:
    ffmpeg, ffprobe = shutil.which("ffmpeg"), shutil.which("ffprobe")
    if not ffmpeg or not ffprobe:
        raise NeedsReview("FFmpeg (with ffprobe) is not installed on the render worker.")
    return ffmpeg, ffprobe


async def _run(args: list[str]) -> None:
    done = await asyncio.to_thread(subprocess.run, args, capture_output=True, text=True)
    if done.returncode != 0:
        raise RenderError((done.stderr or "ffmpeg failed").strip().splitlines()[-1][:300])


def probe(path: Path) -> dict:
    """Duration, size and streams of a media file (ffprobe)."""
    _, ffprobe = tools()
    out = subprocess.run([ffprobe, "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
                          "-of", "json", str(path)], capture_output=True, text=True)
    if out.returncode != 0:
        raise RenderError(f"ffprobe could not read {path.name}")
    info = json.loads(out.stdout or "{}")
    streams = info.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    return {"duration": float(info.get("format", {}).get("duration") or 0), "width": video.get("width"),
            "height": video.get("height"), "video": bool(video),
            "audio": any(s.get("codec_type") == "audio" for s in streams)}


def _latin(text: str) -> str:
    """The card font is Latin-only; leave out text it can't draw rather than show empty boxes."""
    text = text.translate(str.maketrans({"—": "-", "–": "-", "‘": "'", "’": "'", "“": '"', "”": '"', "…": "...", "·": "-"}))
    try:
        text.encode("latin-1")
        return text
    except UnicodeEncodeError:
        return ""


def test_card(w: int, h: int, scene: FilmScene, shot_number: int, description: str) -> bytes:
    """A clearly labelled placeholder frame for a shot made without a video/image provider."""
    from PIL import Image, ImageDraw, ImageFont

    img = Image.new("RGB", (w, h), (18, 18, 20))
    d = ImageDraw.Draw(img)
    s = min(w, h) / 720

    def font(px: float):
        try:
            return ImageFont.load_default(size=max(10, int(px * s)))
        except TypeError:  # very old Pillow: fixed-size bitmap font
            return ImageFont.load_default()

    hue = (scene.number * 47) % 255
    d.rectangle([0, 0, w, int(8 * s)], fill=(212, 168, 75))
    d.rectangle([0, h - int(8 * s), w, h], fill=(60 + hue // 4, 50, 70))
    y = int(60 * s)
    d.text((int(48 * s), y), f"TEST CLIP  -  Scene {scene.number:02d}  -  Shot {shot_number}", font=font(34), fill=(212, 168, 75))
    y += int(64 * s)
    title = _latin(scene.title)
    if title:
        d.text((int(48 * s), y), title[:60], font=font(28), fill=(235, 235, 235))
        y += int(52 * s)
    for line in textwrap.wrap(_latin(description), width=max(30, int(w / (13 * s))))[:6]:
        d.text((int(48 * s), y), line, font=font(22), fill=(170, 170, 178))
        y += int(34 * s)
    d.text((int(48 * s), h - int(60 * s)), "Placeholder: no video provider is connected, so this is not real footage.",
           font=font(18), fill=(120, 120, 128))
    buf = BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


async def voice_track(tmp: Path, wavs: list[bytes]) -> Path | None:
    """Join the shot's dialogue lines into one track, with a short pause between lines."""
    if not wavs:
        return None
    ffmpeg, _ = tools()
    args, chains = [ffmpeg, "-y", "-loglevel", "error"], []
    for i, data in enumerate(wavs):
        p = tmp / f"line{i}.wav"
        p.write_bytes(data)
        args += ["-i", str(p)]
        chains.append(f"[{i}:a]aresample={RATE},aformat=channel_layouts=stereo,apad=pad_dur=0.3[a{i}]")
    graph = ";".join(chains) + ";" + "".join(f"[a{i}]" for i in range(len(wavs))) + f"concat=n={len(wavs)}:v=0:a=1[out]"
    out = tmp / "voice.m4a"
    await _run(args + ["-filter_complex", graph, "-map", "[out]", *AUDIO_OUT, str(out)])
    return out


async def shot_clip(tmp: Path, *, w: int, h: int, seconds: float, video: Path | None = None, still: Path | None = None,
                    audio: Path | None = None) -> Path:
    """One shot as a normalized clip of exactly `seconds` (a longer voice line stretches it, up to 1.5×)."""
    ffmpeg, _ = tools()
    if audio:
        seconds = min(seconds * 1.5, max(seconds, probe(audio)["duration"] + 0.3))
    fit = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},setsar=1,fps={FPS}"
    args = [ffmpeg, "-y", "-loglevel", "error"]
    if video:
        args += ["-i", str(video)]
        vf = f"{fit},tpad=stop_mode=clone:stop_duration={seconds:.2f}"  # a short provider clip holds its last frame
    else:
        args += ["-loop", "1", "-framerate", "1", "-i", str(still)]  # decode the picture once a second; fps= repeats it
        vf = fit
    if audio:
        args += ["-i", str(audio)]
        af = f"aresample={RATE},aformat=channel_layouts=stereo,apad"
    else:
        args += ["-f", "lavfi", "-i", f"anullsrc=r={RATE}:cl=stereo"]
        af = "anull"
    out = tmp / "shot.mp4"
    await _run(args + ["-map", "0:v:0", "-map", "1:a:0", "-vf", vf, "-af", af, "-t", f"{seconds:.3f}",
                       *VIDEO_OUT, *([] if video else ["-tune", "stillimage"]), *AUDIO_OUT, str(out)])
    return out


async def join(paths: list[Path], out: Path) -> Path:
    """Concatenate identically encoded files without re-encoding."""
    ffmpeg, _ = tools()
    listing = out.with_suffix(".txt")
    listing.write_text("".join(f"file '{p.as_posix()}'\n" for p in paths))
    await _run([ffmpeg, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(listing), "-c", "copy",
                "-movflags", "+faststart", str(out)])
    return out


def validate(path: Path, *, expected_seconds: float, w: int, h: int, label: str) -> dict:
    """The output must have picture and sound at the film's size and last as long as its parts."""
    info = probe(path)
    problems = []
    if not info["video"] or not info["audio"]:
        problems.append("missing a video or audio track")
    if (info["width"], info["height"]) != (w, h):
        problems.append(f"frame size {info['width']}×{info['height']} instead of {w}×{h}")
    if abs(info["duration"] - expected_seconds) > max(1.0, 0.02 * expected_seconds):
        problems.append(f"lasts {info['duration']:.1f}s instead of {expected_seconds:.1f}s")
    if problems:
        raise RenderError(f"{label} failed validation: {', '.join(problems)}.")
    return info


async def _fetch(asset: Asset, dest: Path) -> Path:
    dest.write_bytes(await storage.download(asset.url))
    return dest


async def scene_preview(db: Session, project: Project, scene: FilmScene) -> Asset:
    """Join a finished scene's shot clips into one playable scene file."""
    w, h = frame_size(project)
    clips = [db.get(Asset, sh.video_asset_id) for sh in scene.shots]
    if not clips or any(c is None for c in clips):
        raise RenderError(f"Scene {scene.number} has shots without a clip.")
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        parts = [await _fetch(c, tmp / f"s{i:04d}.mp4") for i, c in enumerate(clips)]
        expected = sum(probe(p)["duration"] for p in parts)
        out = await join(parts, tmp / "scene.mp4")
        info = validate(out, expected_seconds=expected, w=w, h=h, label=f"Scene {scene.number}")
        asset = await store_asset(db, project, "film_scene", str(scene.number), ProviderResult(None, provider="ffmpeg", model="concat"),
                                  data=out.read_bytes(), ext="mp4", meta={"seconds": round(info["duration"], 2)},
                                  dependencies=[c.id for c in clips])
    scene.preview_asset_id = asset.id
    db.commit()
    return asset


async def task_film_render(db: Session, job: AIJob, project: Project) -> dict:
    prod = production_of(db, project.id)
    if prod is None:
        raise NeedsReview("Plan the full-length film first.")
    scenes = list(prod.scenes)
    unfinished = [sc.number for sc in scenes if sc.status != "done" or not sc.preview_asset_id]
    if not scenes or unfinished:
        raise NeedsReview(f"Every scene must be generated before the film is rendered (not ready: {', '.join(map(str, unfinished[:10]))}"
                          f"{'…' if len(unfinished) > 10 else ''}).")
    w, h = frame_size(project)
    prod.status, prod.error = "rendering", ""
    db.commit()
    try:
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            parts, expected = [], 0.0
            for i, sc in enumerate(scenes):
                a = db.get(Asset, sc.preview_asset_id)
                p = await _fetch(a, tmp / f"scene{sc.number:04d}.mp4")
                expected += probe(p)["duration"]
                parts.append(p)
                set_progress(db, job, f"Collecting scene {sc.number} of {len(scenes)}", 5 + int(70 * (i + 1) / len(scenes)))
            set_progress(db, job, "Joining the film", 80)
            out = await join(parts, tmp / "film.mp4")
            set_progress(db, job, "Checking the finished file", 92)
            info = validate(out, expected_seconds=expected, w=w, h=h, label="The film")
            asset = await store_asset(db, project, "film_render", "full", ProviderResult(None, provider="ffmpeg", model="concat"),
                                      data=out.read_bytes(), ext="mp4",
                                      meta={"seconds": round(info["duration"], 2), "width": w, "height": h, "scenes": len(scenes)},
                                      dependencies=[sc.preview_asset_id for sc in scenes])
    except RenderError as e:
        prod.status, prod.error = "generated", str(e)
        db.commit()
        raise NeedsReview(str(e)) from e
    prod.final_asset_id, prod.status = asset.id, "rendered"
    db.commit()
    return {"outputUrl": asset.url, "assetId": asset.id, "seconds": round(info["duration"], 2)}
