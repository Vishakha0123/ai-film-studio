"""CineAI backend — FastAPI application."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.film_routes import router as film_router
from app.api.routes import router
from app.config import get_settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
settings = get_settings()



@asynccontextmanager
async def lifespan(_: FastAPI):
    # Jobs run in this process when there is no Redis: pick up long-film work a restart cut off.
    # (With Redis the Arq worker does this on its own startup.)
    if not settings.REDIS_URL:
        from app.services.film_production import recover_interrupted
        try:
            await recover_interrupted()
        except Exception:  # never block startup (e.g. the database isn't migrated yet)
            logging.getLogger("cineai.film").exception("could not check for interrupted long-film jobs")
    yield


app = FastAPI(title="CineAI API", version="0.2.0", description="AI Film Studio — idea to cinematic teaser", lifespan=lifespan)

# While developing, the studio may open on any local address (localhost or 127.0.0.1, any port —
# Vite moves to 5174 when 5173 is busy), so those are always allowed. Other sites still need CORS_ORIGINS.
LOCAL_ORIGINS = r"^https?://(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$"

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=LOCAL_ORIGINS if settings.APP_ENV in ("development", "test") else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")
app.include_router(film_router, prefix="/api/v1")

if settings.STORAGE_BACKEND == "local":
    media = Path(settings.LOCAL_MEDIA_DIR)
    media.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=media), name="media")
    from app.services.reference_portraits import portraits_dir
    portraits = portraits_dir()
    portraits.mkdir(parents=True, exist_ok=True)
    app.mount("/portraits", StaticFiles(directory=portraits), name="portraits")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "version": app.version,
        "authMode": settings.AUTH_MODE,
        "providers": {"story": settings.STORY_PROVIDER, "image": settings.IMAGE_PROVIDER,
                      "video": settings.VIDEO_PROVIDER, "tts": settings.TTS_PROVIDER,
                      "stt": settings.STT_PROVIDER},
    }
