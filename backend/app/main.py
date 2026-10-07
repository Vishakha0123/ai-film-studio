"""CineAI backend — FastAPI application."""

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()

app = FastAPI(title="CineAI API", version="0.2.0", description="AI Film Studio — idea to cinematic teaser")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

if settings.STORAGE_BACKEND == "local":
    media = Path(settings.LOCAL_MEDIA_DIR)
    media.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=media), name="media")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": app.version,
        "authMode": settings.AUTH_MODE,
        "providers": {"story": settings.STORY_PROVIDER, "image": settings.IMAGE_PROVIDER,
                      "video": settings.VIDEO_PROVIDER, "tts": settings.TTS_PROVIDER},
    }
