"""Mock providers — deterministic, free, no network. Used by default and in tests."""

import copy
import json
import math
import struct
from html import escape
from pathlib import Path

from app.providers.base import ImageProvider, ProviderResult, StoryProvider, TTSProvider, VideoProvider

SAMPLE = json.loads((Path(__file__).parent / "data" / "sample_film.json").read_text(encoding="utf-8"))


class MockStory(StoryProvider):
    async def plan_film(self, brief: dict) -> ProviderResult:
        film = copy.deepcopy(SAMPLE)
        if brief.get("genres"):
            film["genre"] = " / ".join(brief["genres"][:2])
        film["dialogue"] = [
            {"character": "Elena", "text": "Thomas… you told me the score was finished.", "tone": "Grief"},
            {"character": "Elena", "text": "The notation changed. This isn't what I wrote.", "tone": "Horror"},
        ]
        return ProviderResult(film, provider="mock", model="sample-film")

    async def edit(self, memory: dict, target: str, instruction: str) -> ProviderResult:
        value = copy.deepcopy(memory.get(target))
        if isinstance(value, str) and instruction:
            value = f"{value}\n\n[Revised: {instruction}]"
        return ProviderResult(value, provider="mock", model="echo")


class MockImage(ImageProvider):
    async def generate_image(self, prompt: str, *, size: str = "1536x1024", references=None) -> ProviderResult:
        w, h = (int(x) for x in size.split("x"))
        hue = sum(map(ord, prompt)) % 360
        label = escape(prompt[:90])
        svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">
<defs><radialGradient id="g" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="hsl({hue},18%,24%)"/>
<stop offset="1" stop-color="#09090b"/></radialGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<text x="50%" y="88%" fill="#a1a1aa" font-family="Georgia, serif" font-size="{max(14, w // 50)}" text-anchor="middle">{label}</text>
</svg>"""
        return ProviderResult(svg.encode(), provider="mock", model="svg-placeholder")


class MockVideo(VideoProvider):
    async def generate_video(self, prompt: str, *, image_url: str, duration: int, quality: str, aspect_ratio: str) -> ProviderResult:
        return ProviderResult(None, provider="mock", model="none")  # no motion in mock mode


def _tone_wav(seconds: float = 1.0, freq: float = 220.0, rate: int = 16000) -> bytes:
    n = int(seconds * rate)
    frames = b"".join(struct.pack("<h", int(3000 * math.sin(2 * math.pi * freq * i / rate) * min(1, (n - i) / 800))) for i in range(n))
    header = b"RIFF" + struct.pack("<I", 36 + len(frames)) + b"WAVEfmt " + struct.pack("<IHHIIHH", 16, 1, 1, rate, rate * 2, 2, 16) + b"data" + struct.pack("<I", len(frames))
    return header + frames


class MockTTS(TTSProvider):
    async def generate_voice(self, text: str, *, language: str = "en-IN", speaker: str | None = None) -> ProviderResult:
        return ProviderResult(_tone_wav(min(3.0, 0.4 + len(text) / 40)), provider="mock", model="tone")
