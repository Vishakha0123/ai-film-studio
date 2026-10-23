"""Sarvam AI — Sarvam-105B for story/screenplay text, Bulbul for voice.

Docs: https://docs.sarvam.ai/api-reference/chat/chat-completions-v1
      https://docs.sarvam.ai/api-reference/text-to-speech/convert
"""

import base64
import json

import httpx

from app.config import get_settings
from app.prompts import EDIT, FILM_OUTLINE, PLAN_FILM, SCENE_BREAKDOWN, TRANSLATE_FILM, render
from app.providers._json import extract_json
from app.providers.base import ProviderError, ProviderResult, STTProvider, StoryProvider, TTSProvider
from app.services.languages import describe

LANG_CODES = {"en": "en-IN", "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN", "ml": "ml-IN",
              "bn": "bn-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN", "od": "od-IN"}


def _raise_for(r: httpx.Response) -> None:
    if r.status_code >= 400:
        raise ProviderError(f"Sarvam API {r.status_code}: {r.text[:300]}", transient=r.status_code in (429, 500, 502, 503, 504))



# Settings → Film length: how many scenes the plan has
SCENE_COUNTS = {"short": 3, "medium": 5, "long": 8}

class SarvamStory(StoryProvider):
    async def _post(self, prompt: str, *, max_tokens: int, reasoning: str | None) -> dict:
        s = get_settings()
        payload = {
            "model": s.SARVAM_CHAT_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.7,
            "max_tokens": max_tokens,
            "response_format": {"type": "json_object"},
            "reasoning_effort": reasoning,  # None turns the model's thinking off
        }
        async with httpx.AsyncClient(timeout=300) as client:
            try:
                r = await client.post(
                    f"{s.SARVAM_BASE_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {s.SARVAM_API_KEY}", "api-subscription-key": s.SARVAM_API_KEY},
                    json=payload,
                )
            except httpx.TransportError as e:
                raise ProviderError(f"Sarvam unreachable: {e}", transient=True) from e
        _raise_for(r)
        return r.json()

    async def _chat(self, prompt: str, *, effort_setting: str | None = None) -> ProviderResult:
        s = get_settings()
        if not s.SARVAM_API_KEY:
            raise ProviderError("SARVAM_API_KEY is not set")
        effort = (s.SARVAM_REASONING_EFFORT if effort_setting is None else effort_setting or "").strip().lower()
        reasoning = None if effort in ("", "none", "off") else effort
        body = await self._post(prompt, max_tokens=s.SARVAM_MAX_TOKENS, reasoning=reasoning)
        choice = body["choices"][0]
        content = choice.get("message", {}).get("content") or ""
        usage = dict(body.get("usage") or {})
        try:
            data = extract_json(content)
        except (ValueError, json.JSONDecodeError) as first_error:
            if choice.get("finish_reason") != "length":
                raise ProviderError(f"Sarvam returned invalid JSON: {first_error}", transient=True) from first_error
            # The reply ran out of room (long film, non-Latin script, thinking). Once more: no thinking, twice the room.
            body = await self._post(prompt, max_tokens=s.SARVAM_MAX_TOKENS * 2, reasoning=None)
            choice = body["choices"][0]
            content = choice.get("message", {}).get("content") or ""
            for k, v in (body.get("usage") or {}).items():
                if isinstance(v, int):
                    usage[k] = usage.get(k, 0) + v
            try:
                data = extract_json(content)
            except (ValueError, json.JSONDecodeError) as e:
                if choice.get("finish_reason") == "length":
                    raise ProviderError("The film was too long for the story model to finish in one reply. "
                                        "Try a shorter teaser length in Settings, or try again.") from e
                raise ProviderError(f"Sarvam returned invalid JSON: {e}", transient=True) from e
        return ProviderResult(data, provider="sarvam", model=s.SARVAM_CHAT_MODEL, usage=usage, cost=s.COST_PER_STORY_CALL)

    async def plan_film(self, brief: dict) -> ProviderResult:
        seconds = int(brief.get("teaserSeconds") or 30)
        shot_count = max(4, min(10, round(seconds / 4)))
        scene_count = SCENE_COUNTS.get(brief.get("filmLength") or "medium", 5)
        prompt = render(PLAN_FILM, brief=json.dumps(brief, ensure_ascii=False, indent=2),
                        shot_count=shot_count, teaser_seconds=seconds, scene_count=scene_count,
                        output_language=describe(brief.get("language") or "en"))
        return await self._chat(prompt)

    async def edit(self, memory: dict, target: str, instruction: str, *, language: str = "en") -> ProviderResult:
        prompt = render(EDIT, target=target, instruction=instruction, output_language=describe(language),
                        memory=json.dumps(memory, ensure_ascii=False)[:12000])
        res = await self._chat(prompt, effort_setting=get_settings().SARVAM_EDIT_REASONING_EFFORT)
        if not isinstance(res.data, dict) or "value" not in res.data:
            raise ProviderError("Sarvam edit reply had no 'value'", transient=True)
        res.data = res.data["value"]
        return res

    async def outline_scenes(self, bible: dict, *, first: int, last: int, total: int, target_seconds: int,
                             story_so_far: list[dict], language: str) -> ProviderResult:
        act1, act2 = max(1, round(total * 0.25)), max(2, round(total * 0.75))
        recent = story_so_far[-12:]
        prompt = render(FILM_OUTLINE, first=first, last=last, total=total, minutes=round(target_seconds / 60),
                        avg_seconds=round(target_seconds / total), output_language=describe(language),
                        act1_end=act1, act2_start=act1 + 1, act2_end=act2, act3_start=act2 + 1,
                        ending_note="These are the final scenes: resolve every storyline and end the film." if last == total else "",
                        bible=json.dumps(bible, ensure_ascii=False)[:8000],
                        story_so_far="\n".join(f"{s['number']}. {s['title']}: {s['summary']}" for s in recent) or "(this is the start)")
        return await self._chat(prompt, effort_setting=get_settings().SARVAM_EDIT_REASONING_EFFORT)

    async def break_down_scene(self, bible: dict, scene: dict, *, total: int, shot_count: int, shot_seconds: int,
                               previous: str, next_scene: str, language: str) -> ProviderResult:
        prompt = render(SCENE_BREAKDOWN, number=scene["number"], total=total, shot_count=shot_count,
                        shot_seconds=shot_seconds, target_seconds=scene["seconds"], output_language=describe(language),
                        bible=json.dumps(bible, ensure_ascii=False)[:8000], scene=json.dumps(scene, ensure_ascii=False),
                        previous=previous or "(this is the first scene)", next=next_scene or "(this is the last scene)")
        return await self._chat(prompt, effort_setting=get_settings().SARVAM_EDIT_REASONING_EFFORT)

    async def translate_film(self, memory: dict, language: str) -> ProviderResult:
        prompt = render(TRANSLATE_FILM, output_language=describe(language),
                        memory=json.dumps(memory, ensure_ascii=False))
        return await self._chat(prompt, effort_setting=get_settings().SARVAM_EDIT_REASONING_EFFORT)


class SarvamTTS(TTSProvider):
    async def generate_voice(self, text: str, *, language: str = "en-IN", speaker: str | None = None,
                             pace: float = 1.0) -> ProviderResult:
        s = get_settings()
        if not s.SARVAM_API_KEY:
            raise ProviderError("SARVAM_API_KEY is not set")
        lang = LANG_CODES.get(language, language if "-" in language else "en-IN")
        async with httpx.AsyncClient(timeout=120) as client:
            try:
                r = await client.post(
                    f"{s.SARVAM_BASE_URL}/text-to-speech",
                    headers={"api-subscription-key": s.SARVAM_API_KEY},
                    json={"text": text[:2500], "language_code": lang, "speaker": speaker or s.SARVAM_TTS_SPEAKER,
                          "model": s.SARVAM_TTS_MODEL, "output_audio_codec": "wav",
                          "pace": max(0.5, min(2.0, pace))},
                )
            except httpx.TransportError as e:
                raise ProviderError(f"Sarvam unreachable: {e}", transient=True) from e
        _raise_for(r)
        audio = base64.b64decode(r.json()["audios"][0])
        return ProviderResult(audio, provider="sarvam", model=s.SARVAM_TTS_MODEL, cost=s.COST_PER_TTS_LINE)


class SarvamSTT(STTProvider):
    """Saaras speech-to-text (REST, clips under ~30 s). Docs: /api-reference-docs/speech-to-text/transcribe"""

    async def transcribe(self, audio: bytes, *, filename: str, language: str = "en-IN") -> ProviderResult:
        s = get_settings()
        if not s.SARVAM_API_KEY:
            raise ProviderError("SARVAM_API_KEY is not set")
        lang = LANG_CODES.get(language, language if "-" in language else "unknown")
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                r = await client.post(
                    f"{s.SARVAM_BASE_URL}/speech-to-text",
                    headers={"api-subscription-key": s.SARVAM_API_KEY},
                    files={"file": (filename, audio, "audio/webm" if filename.endswith(".webm") else "application/octet-stream")},
                    data={"model": s.SARVAM_STT_MODEL, "language_code": lang},
                )
            except httpx.TransportError as e:
                raise ProviderError(f"Sarvam unreachable: {e}", transient=True) from e
        _raise_for(r)
        return ProviderResult(r.json().get("transcript", "").strip(), provider="sarvam", model=s.SARVAM_STT_MODEL)
