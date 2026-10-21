"""Typed request/response schemas. JSON uses camelCase to match the frontend types."""

from datetime import datetime, timezone
from typing import Annotated, Literal

import unicodedata

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel


# SQLite drops timezone info; every stored timestamp is UTC, so make that explicit in the API.
UTCDateTime = Annotated[datetime, AfterValidator(lambda d: d if d.tzinfo else d.replace(tzinfo=timezone.utc))]


class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- Film project memory (mirrors frontend/src/types.ts) ----------

def _to_int(v: object) -> object:
    """'௧', '१२', '3.' → 1, 12, 3 (story models write numbers in the film's script)."""
    if isinstance(v, str):
        digits = "".join(str(unicodedata.digit(c)) for c in v if unicodedata.digit(c, None) is not None)
        return int(digits) if digits else 0
    return v


class FilmPart(Schema):
    """Tolerant of how story models really write JSON: numbers where text is expected (age 16),
    null for empty fields, numbers in Indian scripts. A film shouldn't fail over formatting."""
    model_config = ConfigDict(coerce_numbers_to_str=True)

    @model_validator(mode="before")
    @classmethod
    def _drop_nulls(cls, data: object) -> object:
        if isinstance(data, dict):
            return {k: v for k, v in data.items() if v is not None}
        return data


_FEMALE = {"f", "female", "woman", "girl", "she", "her", "lady", "feminine", "महिला", "स्त्री", "लड़की", "பெண்"}
_MALE = {"m", "male", "man", "boy", "he", "him", "masculine", "पुरुष", "लड़का", "ஆண்"}


def normalize_gender(value: object) -> str:
    """'Female', 'girl', 'F', 'महिला' → 'female'; 'Male', 'boy' → 'male'; anything else → '' (not set)."""
    v = str(value or "").strip().lower()
    return "female" if v in _FEMALE else "male" if v in _MALE else ""


class Character(FilmPart):
    id: str = ""
    name: str
    age: str = ""
    gender: str = ""  # "female" | "male" | "" — picks the drawn portrait (with the age) until one is generated
    role: str = ""
    personality: str = ""
    appearance: str = ""
    arc: str = ""
    relationships: str = ""

    @field_validator("gender", mode="before")
    @classmethod
    def _gender(cls, v: object) -> str:
        return normalize_gender(v)
    image_id: str = ""  # Unsplash fallback id used by the design
    image_url: str | None = None
    # Closest of the 10 reference portraits for this age and gender (picked automatically; see reference_portraits)
    portrait_ref: str = ""
    reference_image_url: str | None = None  # filled in on the way out (not stored)


class Scene(FilmPart):
    id: str = ""
    number: int = 0
    location: str = ""
    time: str = ""
    characters: list[str] = []
    mood: str = ""
    duration: str = ""
    description: str = ""

    _number = field_validator("number", mode="before")(lambda v: _to_int(v))

    @field_validator("characters", mode="before")
    @classmethod
    def _names(cls, v: object) -> object:
        if isinstance(v, str):  # "Meera, Kaali" → ["Meera", "Kaali"]
            return [n.strip() for n in v.replace("،", ",").split(",") if n.strip()]
        return v


class Shot(FilmPart):
    id: str = ""
    number: int = 0
    duration: str = ""
    camera: str = ""
    movement: str = ""
    description: str = ""
    characters: str = "None"
    mood: str = ""
    image_id: str = ""
    image_url: str | None = None
    video_url: str | None = None

    _number = field_validator("number", mode="before")(lambda v: _to_int(v))

    @field_validator("characters", mode="before")
    @classmethod
    def _names(cls, v: object) -> object:
        return ", ".join(map(str, v)) if isinstance(v, list) else v


AUDIO_TYPES = ("voice", "music", "sfx", "ambience")


class AudioTrack(FilmPart):
    id: str = ""
    type: Literal["voice", "music", "sfx", "ambience"] = "music"
    name: str = ""
    duration: str = ""
    volume: int = 70
    active: bool = True
    url: str | None = None

    @field_validator("type", mode="before")
    @classmethod
    def _kind(cls, v: object) -> object:
        """A translated or unusual type ("இசை", "Music ", "sound effect") becomes the nearest known one."""
        s = str(v).strip().lower()
        if s in AUDIO_TYPES:
            return s
        for kind, words in (("voice", ("voice", "vo", "dialog", "narrat")), ("sfx", ("sfx", "effect", "sound")),
                            ("ambience", ("ambien", "atmos", "background"))):
            if any(w in s for w in words):
                return kind
        return "music"

    @field_validator("volume", mode="before")
    @classmethod
    def _volume(cls, v: object) -> object:
        n = _to_int(v) if isinstance(v, str) else v
        return max(0, min(100, int(n))) if isinstance(n, (int, float)) else 70


class DialogueLine(FilmPart):
    character: str = ""
    text: str
    tone: str = ""
    scene: int | None = None  # the scene this line belongs to (number)

    @model_validator(mode="before")
    @classmethod
    def _shapes(cls, data: object) -> object:
        """Story models write lines in several shapes: "Pooja: Why?!", or speaker/line/dialogue keys."""
        if isinstance(data, str):
            who, sep, said = data.partition(":")
            return {"character": who.strip(), "text": said.strip()} if sep and len(who) < 40 else {"text": data.strip()}
        if isinstance(data, dict):
            d = dict(data)
            for alias in ("speaker", "name", "char", "role"):
                if not d.get("character") and d.get(alias):
                    d["character"] = d.pop(alias)
            for alias in ("line", "dialogue", "content", "quote"):
                if not d.get("text") and isinstance(d.get(alias), str):
                    d["text"] = d.pop(alias)
            for alias in ("emotion", "mood", "delivery"):
                if not d.get("tone") and d.get(alias):
                    d["tone"] = d.pop(alias)
            if not d.get("scene") and d.get("sceneNumber"):
                d["scene"] = d.pop("sceneNumber")
            return d
        return data

    _scene = field_validator("scene", mode="before")(lambda v: _to_int(v) or None if v not in (None, "") else None)


class Lyrics(FilmPart):
    """The film's theme song, written in the film's language."""
    title: str = ""
    style: str = ""
    verse: str = ""
    pre_chorus: str = ""
    chorus: str = ""
    bridge: str = ""


class FilmProject(FilmPart):
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
    lyrics: Lyrics | None = None
    visual_style: str = ""  # Storyboard look: Photorealistic, Dark Cinema, Anime, 3D Render, Vintage or the creator's own words


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


class LanguageVersionRequest(Schema):
    language: str = Field(min_length=2, max_length=10)


class PlanRequest(Schema):
    prompt: str | None = Field(default=None, max_length=4000)


class EditRequest(Schema):
    target: Literal["story", "logline", "screenplay", "characters", "scenes", "shots", "dialogue", "lyrics"] = "story"
    instruction: str = Field(default="", max_length=2000)
    # Narrow the edit so the model reads and writes only what changes (much faster):
    passage: str | None = Field(default=None, max_length=20000)  # text fields: the selected passage
    item: str | None = Field(default=None, max_length=40)        # list fields: the item's id, or its 1-based position


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
    chat: list[dict] = []
    created_at: UTCDateTime
    updated_at: UTCDateTime


class ProjectSummary(Schema):
    id: str
    title: str
    genre: str
    status: str
    language: str = "en"
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
    # Writing defaults
    visual_style: str = Field(default="Dark Cinema", max_length=120)  # storyboard look new films start with
    film_length: Literal["short", "medium", "long"] = "medium"      # how many scenes the AI writes
    # Voice defaults (Sarvam Bulbul)
    voice: str = Field(default="shubh", max_length=40)
    voice_pace: float = Field(default=1.0, ge=0.5, le=2.0)


class ChatLine(Schema):
    """One message of the AI Director chat, kept with the project so a refresh (or another device) shows it."""
    id: str = Field(max_length=80)
    role: Literal["user", "ai"]
    content: str = ""
    card: str | None = Field(default=None, max_length=20)
    attachments: list[str] = Field(default=[], max_length=10)

    @field_validator("content", mode="before")
    @classmethod
    def _trim(cls, v):
        return str(v or "")[:6000]


class ChatLog(Schema):
    messages: list[ChatLine] = Field(max_length=500)


class VoicePreviewRequest(Schema):
    voice: str = Field(default="shubh", max_length=40)
    pace: float = Field(default=1.0, ge=0.5, le=2.0)
    language: str = Field(default="en", max_length=10)


class Me(Schema):
    id: str
    email: str
    preferences: Preferences = Preferences()


class LanguageVersionOut(Schema):
    """A new project holding the film in another language, and the job that's translating it."""
    project: ProjectOut
    job: JobOut


class BulkDeleteRequest(Schema):
    ids: list[str] = Field(min_length=1, max_length=200)


class BulkDeleteResult(Schema):
    deleted: list[str]
    not_found: list[str] = []


class CharacterInput(Schema):
    """A character the creator adds or edits by hand (anything left out keeps its current value)."""
    name: str | None = Field(default=None, max_length=120)
    age: str | None = Field(default=None, max_length=40)
    gender: str | None = Field(default=None, max_length=20)
    role: str | None = Field(default=None, max_length=200)
    personality: str | None = Field(default=None, max_length=2000)
    appearance: str | None = Field(default=None, max_length=2000)
    arc: str | None = Field(default=None, max_length=2000)
    relationships: str | None = Field(default=None, max_length=2000)


MEMORY_FIELDS = ("story", "logline", "screenplay", "scenes", "shots", "dialogue", "lyrics", "visualStyle", "tone")


class MemoryPatch(Schema):
    """The creator's own edits to parts of the film (anything left out stays as it is)."""
    story: str | None = Field(default=None, max_length=20000)
    logline: str | None = Field(default=None, max_length=1000)
    screenplay: str | None = Field(default=None, max_length=60000)
    tone: str | None = Field(default=None, max_length=300)
    visual_style: str | None = Field(default=None, max_length=300)
    scenes: list[dict] | None = None
    shots: list[dict] | None = None
    dialogue: list[dict] | None = None
    lyrics: dict | None = None
