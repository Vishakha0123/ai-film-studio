"""Mock providers — deterministic, free, no network. Used by default and in tests."""

import copy
import json
import math
import struct
from html import escape
from pathlib import Path

from app.providers.base import ImageProvider, ProviderResult, StoryProvider, STTProvider, TTSProvider, VideoProvider

SAMPLE = json.loads((Path(__file__).parent / "data" / "sample_film.json").read_text(encoding="utf-8"))

SAMPLE_LYRICS = {
    "title": "Between the Rests",
    "style": "Dark Classical",
    "verse": "Between the rests, I still remain\nIn the silence after rain\nEvery measure, every note\nThe words that you could never quote",
    "preChorus": "Listen close — the score explains\nWhat the living can't contain",
    "chorus": "I am the music in the walls\nThe echo down your hallway's halls\nPlay the final page and see\nI never left — I cannot leave",
    "bridge": "Andante — slow, like grief descends\nFortissimo — where longing ends",
}


class MockStory(StoryProvider):
    async def plan_film(self, brief: dict) -> ProviderResult:
        film = copy.deepcopy(SAMPLE)
        if brief.get("genres"):
            film["genre"] = " / ".join(brief["genres"][:2])
        film["dialogue"] = [
            {"character": "Elena", "text": "Thomas… you told me the score was finished.", "tone": "Grief"},
            {"character": "Elena", "text": "The notation changed. This isn't what I wrote.", "tone": "Horror"},
        ]
        film["lyrics"] = copy.deepcopy(SAMPLE_LYRICS)
        return ProviderResult(film, provider="mock", model="sample-film")

    async def translate_film(self, memory: dict, language: str) -> ProviderResult:
        # No translation without a model: keep the text and mark the title so the version is recognisable.
        from app.services.languages import native_name
        film = copy.deepcopy(memory)
        film["title"] = f"{film.get('title', 'Untitled')} ({native_name(language)})"
        return ProviderResult(film, provider="mock", model="echo")

    async def edit(self, memory: dict, target: str, instruction: str, *, language: str = "en") -> ProviderResult:
        value = copy.deepcopy(memory.get(target))
        if target == "characters" and isinstance(value, list):
            # Deterministic stand-ins for the AI: "Add one new character: …" and "Rewrite only the character with id "N" …"
            import re
            if instruction.startswith("Add one new character"):
                idea = instruction.split(":", 1)[-1].split(". Write", 1)[0].strip() or "a new character"
                value.append({"id": str(len(value) + 1), "name": idea.split(",")[0][:40].strip().title() or "New Character",
                              "role": "Supporting", "age": "", "personality": idea, "appearance": f"Look inspired by: {idea}",
                              "arc": "", "relationships": ""})
            elif m := re.search(r'id "([^"]+)"', instruction):
                for c in value:
                    if str(c.get("id")) == m.group(1):
                        c["personality"] = f"{c.get('personality', '')} [Revised: {instruction[:60]}]"
            return ProviderResult(value, provider="mock", model="echo")
        if target in ("dialogue", "shots") and isinstance(value, list):
            # Stand-ins for the AI: "Add N more…" appends; a targeted rewrite ("line 2", 'id "3"') marks that item.
            import re
            key = "text" if target == "dialogue" else "description"
            if instruction.lower().startswith(("add", "write")) and target == "dialogue":
                who = value[0]["character"] if value else "Narrator"
                scene = re.search(r"scene (\d+)", instruction)
                value.append({"character": who, "text": f"[New line: {instruction[:50]}]", "tone": "New",
                              **({"scene": int(scene.group(1))} if scene else {})})
            else:
                m = re.search(r'(?:line |id ")(\d+)', instruction)
                for i, item in enumerate(value):
                    if not m or str(i + 1) == m.group(1) or str(item.get("id")) == m.group(1):
                        item[key] = f"{item.get(key, '')} [Revised: {instruction[:50]}]"
            return ProviderResult(value, provider="mock", model="echo")
        if target == "lyrics":
            value = value or copy.deepcopy(SAMPLE_LYRICS)
            if instruction and memory.get(target):
                value["verse"] = f"{value.get('verse', '')}\n[Revised: {instruction}]"
            return ProviderResult(value, provider="mock", model="echo")
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
    async def generate_voice(self, text: str, *, language: str = "en-IN", speaker: str | None = None,
                             pace: float = 1.0) -> ProviderResult:
        return ProviderResult(_tone_wav(min(3.0, 0.4 + len(text) / 40)), provider="mock", model="tone")


class MockSTT(STTProvider):
    async def transcribe(self, audio: bytes, *, filename: str, language: str = "en-IN") -> ProviderResult:
        return ProviderResult("", provider="mock", model="none")
