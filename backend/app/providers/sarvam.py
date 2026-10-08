"""Sarvam AI — Sarvam-105B for story/screenplay text, Bulbul for voice.

Docs: https://docs.sarvam.ai/api-reference/chat/chat-completions-v1
      https://docs.sarvam.ai/api-reference/text-to-speech/convert
"""

import base64
import json

import httpx

from app.config import get_settings
from app.prompts import EDIT, PLAN_FILM, render
from app.providers._json import extract_json
from app.providers.base import ProviderError, ProviderResult, STTProvider, StoryProvider, TTSProvider

LANG_CODES = {"en": "en-IN", "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN", "ml": "ml-IN",
              "bn": "bn-IN", "mr": "mr-IN", "gu": "gu-IN", "pa": "pa-IN", "od": "od-IN"}


def _raise_for(r: httpx.Response) -> None:
    if r.status_code >= 400:
        raise ProviderError(f"Sarvam API {r.status_code}: {r.text[:300]}", transient=r.status_code in (429, 500, 502, 503, 504))


class SarvamStory(StoryProvider):
    async def _chat(self, prompt: str) -> ProviderResult:
        s = get_settings()
        if not s.SARVAM_API_KEY:
            raise ProviderError("SARVAM_API_KEY is not set")
        async with httpx.AsyncClient(timeout=180) as client:
            try:
                r = await client.post(
                    f"{s.SARVAM_BASE_URL}/v1/chat/completions",
                    headers={"Authorization": f"Bearer {s.SARVAM_API_KEY}", "api-subscription-key": s.SARVAM_API_KEY},
                    json={
                        "model": s.SARVAM_CHAT_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.7,
                        "max_tokens": 6000,
                        "response_format": {"type": "json_object"},
                    },
                )
            except httpx.TransportError as e:
                raise ProviderError(f"Sarvam unreachable: {e}", transient=True) from e
        _raise_for(r)
        body = r.json()
        content = body["choices"][0]["message"]["content"]
        try:
            data = extract_json(content)
        except (ValueError, json.JSONDecodeError) as e:
            raise ProviderError(f"Sarvam returned invalid JSON: {e}", transient=True) from e
        usage = body.get("usage", {})
        return ProviderResult(data, provider="sarvam", model=s.SARVAM_CHAT_MODEL, usage=usage, cost=s.COST_PER_STORY_CALL)

    async def plan_film(self, brief: dict) -> ProviderResult:
        seconds = int(brief.get("teaserSeconds") or 30)
        shot_count = max(4, min(10, round(seconds / 4)))
        prompt = render(PLAN_FILM, brief=json.dumps(brief, ensure_ascii=False, indent=2),
                        shot_count=shot_count, teaser_seconds=seconds)
        return await self._chat(prompt)

    async def edit(self, memory: dict, target: str, instruction: str) -> ProviderResult:
        prompt = render(EDIT, target=target, instruction=instruction,
                        memory=json.dumps(memory, ensure_ascii=False)[:12000])
        res = await self._chat(prompt)
        if not isinstance(res.data, dict) or "value" not in res.data:
            raise ProviderError("Sarvam edit reply had no 'value'", transient=True)
        res.data = res.data["value"]
        return res


class SarvamTTS(TTSProvider):
    async def generate_voice(self, text: str, *, language: str = "en-IN", speaker: str | None = None) -> ProviderResult:
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
                          "model": s.SARVAM_TTS_MODEL, "output_audio_codec": "wav"},
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
