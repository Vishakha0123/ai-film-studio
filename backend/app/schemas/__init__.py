"""Typed request/response schemas. JSON uses camelCase to match the frontend types."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- Film project memory (mirrors frontend/src/types.ts) ----------

class Character(Schema):
    id: str
    name: str
    age: str = ""
    role: str = ""
    personality: str = ""
    appearance: str = ""
    arc: str = ""
    relationships: str = ""
    image_id: str = ""  # Unsplash fallback id used by the design
    image_url: str | None = None


class Scene(Schema):
    id: str
    number: int
    location: str
    time: str = ""
    characters: list[str] = []
    mood: str = ""
    duration: str = ""
    description: str = ""


class Shot(Schema):
    id: str
    number: int
    duration: str = ""
    camera: str = ""
    movement: str = ""
    description: str = ""
    characters: str = "None"
    mood: str = ""
    image_id: str = ""
    image_url: str | None = None
    video_url: str | None = None


class AudioTrack(Schema):
    id: str
    type: Literal["voice", "music", "sfx", "ambience"]
    name: str
    duration: str = ""
    volume: int = 70
    active: bool = True
    url: str | None = None


class DialogueLine(Schema):
    character: str
    text: str
    tone: str = ""


class FilmProject(Schema):
    title: str
    genre: str = ""
    tone: str = ""
    logline: str = ""
    story: str = ""
    characters: list[Character] = []
    screenplay: str = ""
    scenes: list[Scene] = []
    shots: list[Shot] = []
    audio_tracks: list[AudioTrack] = []
    dialogue: list[DialogueLine] = []


# ---------- API ----------

class ProjectCreate(Schema):
    title: str | None = Field(default=None, max_length=300)
    genres: list[str] = []
    language: str = "en"


class Brief(Schema):
    prompt: str = Field(min_length=1, max_length=4000)
    genres: list[str] = []
    language: str = "en"
    tone: str = ""
    teaser_seconds: int = Field(default=30, ge=5, le=60)
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"


class PlanRequest(Schema):
    prompt: str | None = Field(default=None, max_length=4000)


class EditRequest(Schema):
    target: Literal["story", "logline", "screenplay", "characters", "scenes", "shots", "dialogue"] = "story"
    instruction: str = Field(default="", max_length=2000)


class ApproveRequest(Schema):
    step: str = Field(max_length=40)
    approved: bool = True
    note: str = ""


class GenerateRequest(Schema):
    quality: Literal["draft", "final"] = "draft"
    confirm_cost: bool = False


class RenderRequest(Schema):
    format: Literal["16:9", "9:16", "1:1"] = "16:9"
    quality: Literal["720", "1080", "4k"] = "1080"


class AssetOut(Schema):
    id: str
    type: str
    ref: str
    url: str
    provider: str
    version: int
    status: str
    meta: dict = {}


class ProjectOut(Schema):
    id: str
    title: str
    genre: str
    language: str
    status: str
    brief: dict
    memory: FilmProject | None
    assets: list[AssetOut] = []
    created_at: datetime
    updated_at: datetime


class ProjectSummary(Schema):
    id: str
    title: str
    genre: str
    status: str
    updated_at: datetime


class JobOut(Schema):
    id: str
    project_id: str
    task: str
    status: str
    stage: str
    progress: int
    result: dict
    cost: float
    error: str
    created_at: datetime
    updated_at: datetime


class CostEstimate(Schema):
    quality: Literal["draft", "final"]
    images: int
    video_seconds: float
    voice_lines: int
    estimated_cost: float
    currency: str = "USD"
    requires_confirmation: bool


class Me(Schema):
    id: str
    email: str
