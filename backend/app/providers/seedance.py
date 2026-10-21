"""Seedance image-to-video via Atlas Cloud.

Submit:  POST {ATLAS_BASE_URL}/model/generateVideo
Poll:    GET  {ATLAS_BASE_URL}/model/prediction/{id}   → data.status, data.outputs[0]
"""

import asyncio
import time

import httpx

from app.config import get_settings
from app.providers.base import ProviderError, ProviderResult, VideoProvider


class SeedanceVideo(VideoProvider):
    async def generate_video(self, prompt: str, *, image_url: str, duration: int, quality: str, aspect_ratio: str) -> ProviderResult:
        s = get_settings()
        if not s.ATLAS_API_KEY:
            raise ProviderError("ATLAS_API_KEY is not set")
        headers = {"Authorization": f"Bearer {s.ATLAS_API_KEY}"}
        resolution = s.SEEDANCE_FINAL_RESOLUTION if quality == "final" else s.SEEDANCE_DRAFT_RESOLUTION
        payload = {
            "model": s.SEEDANCE_MODEL,
            "prompt": prompt,
            "image": image_url,  # must be publicly reachable (use Supabase Storage in deployed envs)
            "duration": max(2, min(12, duration)),
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
            "camera_fixed": False,
        }
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                r = await client.post(f"{s.ATLAS_BASE_URL}/model/generateVideo", headers=headers, json=payload)
            except httpx.TransportError as e:
                raise ProviderError(f"Atlas Cloud unreachable: {e}", transient=True) from e
            if r.status_code >= 400:
                raise ProviderError(f"Atlas Cloud {r.status_code}: {r.text[:300]}", transient=r.status_code in (429, 500, 502, 503))
            prediction_id = (r.json().get("data") or {}).get("id")
            if not prediction_id:
                raise ProviderError(f"Atlas Cloud returned no prediction id: {r.text[:200]}")

            deadline = time.monotonic() + s.PROVIDER_TIMEOUT_SECONDS
            while time.monotonic() < deadline:
                await asyncio.sleep(s.PROVIDER_POLL_INTERVAL_SECONDS)
                p = await client.get(f"{s.ATLAS_BASE_URL}/model/prediction/{prediction_id}", headers=headers)
                if p.status_code >= 400:
                    continue
                data = p.json().get("data") or {}
                status = data.get("status")
                if status in ("completed", "succeeded"):
                    seconds = payload["duration"]
                    rate = s.COST_PER_VIDEO_SECOND_FINAL if quality == "final" else s.COST_PER_VIDEO_SECOND_DRAFT
                    return ProviderResult(data["outputs"][0], provider="seedance", model=s.SEEDANCE_MODEL,
                                          usage={"seconds": seconds, "prediction_id": prediction_id}, cost=seconds * rate)
                if status == "failed":
                    raise ProviderError(f"Seedance generation failed: {data.get('error') or 'unknown error'}")
        raise ProviderError("Seedance generation timed out", transient=True)
