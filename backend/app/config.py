"""Application settings — every secret comes from environment variables (.env)."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_ENV: Literal["development", "staging", "production", "test"] = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:4173"]
    PUBLIC_BASE_URL: str = "http://localhost:8000"  # used to build URLs for locally stored media

    # --- Database (Supabase Postgres in staging/prod; SQLite works for local dev & tests) ---
    DATABASE_URL: str = "sqlite:///./cineai.db"

    # --- Auth ---
    # "supabase": verify Supabase access tokens (JWKS, or legacy HS256 secret)
    # "dev": accept `Bearer dev:<email>` tokens — local development & tests ONLY
    AUTH_MODE: Literal["supabase", "dev"] = "supabase"
    SUPABASE_URL: str = ""  # https://<project-ref>.supabase.co
    SUPABASE_JWT_SECRET: str = ""  # only for projects still on legacy HS256 signing
    SUPABASE_JWT_AUDIENCE: str = "authenticated"
    SUPABASE_SERVICE_ROLE_KEY: str = ""  # server-side only — used for Storage uploads

    # --- Storage ---
    STORAGE_BACKEND: Literal["local", "supabase"] = "local"
    LOCAL_MEDIA_DIR: str = "./media"
    SUPABASE_STORAGE_BUCKET: str = "assets"

    # --- Jobs ---
    REDIS_URL: str = ""  # set to run jobs on the Arq worker; empty = run in-process

    # --- AI providers ("mock" works with no keys) ---
    STORY_PROVIDER: Literal["mock", "sarvam"] = "mock"
    IMAGE_PROVIDER: Literal["mock", "openai"] = "mock"
    VIDEO_PROVIDER: Literal["mock", "seedance"] = "mock"
    TTS_PROVIDER: Literal["mock", "sarvam"] = "mock"
    STT_PROVIDER: Literal["mock", "sarvam"] = "mock"  # voice input in the AI Director chat

    SARVAM_API_KEY: str = ""
    SARVAM_BASE_URL: str = "https://api.sarvam.ai"
    SARVAM_CHAT_MODEL: str = "sarvam-105b"
    SARVAM_TTS_MODEL: str = "bulbul:v3"
    SARVAM_TTS_SPEAKER: str = "shubh"
    SARVAM_STT_MODEL: str = "saaras:v3"

    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_IMAGE_MODEL: str = "gpt-image-1"

    ATLAS_API_KEY: str = ""
    ATLAS_BASE_URL: str = "https://api.atlascloud.ai/api/v1"
    # Check the exact Seedance model id in your Atlas Cloud console
    SEEDANCE_MODEL: str = "bytedance/seedance-v1.5-pro/image-to-video"
    SEEDANCE_DRAFT_RESOLUTION: str = "480p"
    SEEDANCE_FINAL_RESOLUTION: str = "1080p"
    PROVIDER_POLL_INTERVAL_SECONDS: float = 5.0
    PROVIDER_TIMEOUT_SECONDS: float = 600.0

    # --- Cost estimates (USD per unit; tune to your provider pricing) ---
    COST_PER_STORY_CALL: float = 0.01
    COST_PER_IMAGE: float = 0.04
    COST_PER_VIDEO_SECOND_DRAFT: float = 0.03
    COST_PER_VIDEO_SECOND_FINAL: float = 0.10
    COST_PER_TTS_LINE: float = 0.002
    COST_CONFIRM_THRESHOLD: float = 1.00  # ask the creator to confirm above this

    # --- Limits ---
    MAX_PROMPT_CHARS: int = 4000
    MAX_PROJECTS_PER_USER: int = Field(default=100)


@lru_cache
def get_settings() -> Settings:
    return Settings()
