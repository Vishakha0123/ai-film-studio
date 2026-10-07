"""OpenAI image generation (GPT Image) for character portraits and storyboard frames."""

import base64

import httpx

from app.config import get_settings
from app.providers.base import ImageProvider, ProviderError, ProviderResult


class OpenAIImage(ImageProvider):
    async def generate_image(self, prompt: str, *, size: str = "1536x1024", references: list[bytes] | None = None) -> ProviderResult:
        s = get_settings()
        if not s.OPENAI_API_KEY:
            raise ProviderError("OPENAI_API_KEY is not set")
        headers = {"Authorization": f"Bearer {s.OPENAI_API_KEY}"}
        async with httpx.AsyncClient(timeout=240) as client:
            try:
                if references:
                    # Image edits endpoint keeps character/location references consistent across shots.
                    files = [("image[]", (f"ref{i}.png", ref, "image/png")) for i, ref in enumerate(references[:4])]
                    r = await client.post(f"{s.OPENAI_BASE_URL}/images/edits", headers=headers, files=files,
                                          data={"model": s.OPENAI_IMAGE_MODEL, "prompt": prompt, "size": size})
                else:
                    r = await client.post(f"{s.OPENAI_BASE_URL}/images/generations", headers=headers,
                                          json={"model": s.OPENAI_IMAGE_MODEL, "prompt": prompt, "size": size, "n": 1})
            except httpx.TransportError as e:
                raise ProviderError(f"OpenAI unreachable: {e}", transient=True) from e
        if r.status_code >= 400:
            raise ProviderError(f"OpenAI images {r.status_code}: {r.text[:300]}", transient=r.status_code in (429, 500, 502, 503))
        item = r.json()["data"][0]
        if item.get("b64_json"):
            data = base64.b64decode(item["b64_json"])
        else:
            async with httpx.AsyncClient(timeout=120) as client:
                data = (await client.get(item["url"])).content
        return ProviderResult(data, provider="openai", model=s.OPENAI_IMAGE_MODEL, cost=s.COST_PER_IMAGE)
