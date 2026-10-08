"""Typed request/response schemas. JSON uses camelCase to match the frontend types."""

from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


# SQLite drops timezone info; every stored timestamp is UTC, so make that explicit in the API.
UTCDateTime = Annotated[datetime, AfterValidator(lambda d: d if d.tzinfo else d.replace(tzinfo=timezone.utc))]


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
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ProjectSummary(Schema):
    id: str
    title: str
    genre: str
    status: str
    logline: str = ""
    thumbnail_url: str | None = None
    asset_count: int = 0
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ProjectUpdate(Schema):
    title: str = Field(min_length=1, max_length=300)


class AssetListItem(AssetOut):
    project_id: str
    project_title: str
    created_at: UTCDateTime


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
    created_at: UTCDateTime
    updated_at: UTCDateTime


class DocumentOut(Schema):
    id: str
    filename: str
    type: str
    size: int
    file_url: str
    source_reference: str
    preview: str = ""  # first characters of the extracted text
    created_at: UTCDateTime


class Transcript(Schema):
    text: str
    provider: str


class CostEstimate(Schema):
    quality: Literal["draft", "final"]
    images: int
    video_seconds: float
    voice_lines: int
    estimated_cost: float
    currency: str = "USD"
    requires_confirmation: bool


class Preferences(Schema):
    """Creator defaults used for new projects."""
    display_name: str = Field(default="", max_length=120)
    language: str = Field(default="en", max_length=10)
    teaser_seconds: int = Field(default=30, ge=5, le=60)
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"
    quality: Literal["draft", "final"] = "draft"


class Me(Schema):
    id: str
    email: str
    preferences: Preferences = Preferences()
