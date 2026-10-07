"""Asset storage: local disk (served at /media) or Supabase Storage."""

import mimetypes
from pathlib import Path

import httpx

from app.config import get_settings


async def save_bytes(path: str, data: bytes, content_type: str | None = None) -> str:
    """Store `data` at `path` (e.g. 'projects/<id>/shots/1.png') and return a public URL."""
    s = get_settings()
    content_type = content_type or mimetypes.guess_type(path)[0] or "application/octet-stream"
    if s.STORAGE_BACKEND == "supabase":
        if not (s.SUPABASE_URL and s.SUPABASE_SERVICE_ROLE_KEY):
            raise RuntimeError("Supabase storage needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        base = s.SUPABASE_URL.rstrip("/")
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(
                f"{base}/storage/v1/object/{s.SUPABASE_STORAGE_BUCKET}/{path}",
                content=data,
                headers={
                    "Authorization": f"Bearer {s.SUPABASE_SERVICE_ROLE_KEY}",
                    "apikey": s.SUPABASE_SERVICE_ROLE_KEY,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
            )
            r.raise_for_status()
        return f"{base}/storage/v1/object/public/{s.SUPABASE_STORAGE_BUCKET}/{path}"

    target = Path(s.LOCAL_MEDIA_DIR) / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return f"{s.PUBLIC_BASE_URL.rstrip('/')}/media/{path}"


async def download(url: str) -> bytes:
    """Fetch a remote asset (e.g. a provider's video URL) so we can keep our own copy."""
    s = get_settings()
    prefix = f"{s.PUBLIC_BASE_URL.rstrip('/')}/media/"
    if url.startswith(prefix):  # local asset — read from disk
        return (Path(s.LOCAL_MEDIA_DIR) / url[len(prefix):]).read_bytes()
    async with httpx.AsyncClient(timeout=300, follow_redirects=True) as client:
        r = await client.get(url)
        r.raise_for_status()
        return r.content
