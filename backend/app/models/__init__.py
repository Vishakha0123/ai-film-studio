"""ORM models — tables from the project report (section 27)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

# JSONB on Postgres (Supabase), plain JSON elsewhere (SQLite in dev/tests)
JSONType = JSON().with_variant(JSONB(), "postgresql")


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class User(TimestampMixin, Base):
    """Mirror of the Supabase auth user (id = auth.users.id)."""

    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), default="")
    profile: Mapped[dict] = mapped_column(JSONType, default=dict)


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(300), default="Untitled Film")
    genre: Mapped[str] = mapped_column(String(200), default="")
    language: Mapped[str] = mapped_column(String(20), default="en")
    status: Mapped[str] = mapped_column(String(40), default="draft")
    brief: Mapped[dict] = mapped_column(JSONType, default=dict)
    # The AI Director conversation (kept apart from the brief so the two are never saved over each other)
    chat: Mapped[list] = mapped_column(JSONType, default=list, server_default="[]")
    # Project memory: story, characters, screenplay, scenes, shots, audio tracks (flexible → JSONB)
    memory: Mapped[dict] = mapped_column(JSONType, default=dict)

    assets: Mapped[list["Asset"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ProjectDocument(TimestampMixin, Base):
    """Source material the creator attached (script, story PDF, reference image)."""

    __tablename__ = "project_documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    type: Mapped[str] = mapped_column(String(20))  # text | pdf | docx | image
    content_type: Mapped[str] = mapped_column(String(120), default="")
    size: Mapped[int] = mapped_column(Integer, default=0)
    file_url: Mapped[str] = mapped_column(Text, default="")
    extracted_text: Mapped[str] = mapped_column(Text, default="")
    source_reference: Mapped[str] = mapped_column(String(255), default="")  # e.g. "pages 1-3"


class Asset(TimestampMixin, Base):
    __tablename__ = "assets"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    type: Mapped[str] = mapped_column(String(40))  # character_image | storyboard_image | video_clip | voice | render
    ref: Mapped[str] = mapped_column(String(80), default="")  # e.g. character id or shot number
    url: Mapped[str] = mapped_column(Text, default="")
    provider: Mapped[str] = mapped_column(String(60), default="")
    model: Mapped[str] = mapped_column(String(120), default="")
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(30), default="ready")  # ready | outdated | failed
    dependencies: Mapped[list] = mapped_column(JSONType, default=list)  # asset ids / memory keys this depends on
    meta: Mapped[dict] = mapped_column(JSONType, default=dict)

    project: Mapped[Project] = relationship(back_populates="assets")


class AIJob(TimestampMixin, Base):
    __tablename__ = "ai_jobs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    task: Mapped[str] = mapped_column(String(40))  # plan | edit | generate | regenerate | render
    params: Mapped[dict] = mapped_column(JSONType, default=dict)
    provider: Mapped[str] = mapped_column(String(60), default="")
    status: Mapped[str] = mapped_column(String(20), default="queued")  # queued|running|completed|failed|cancelled|needs_review
    stage: Mapped[str] = mapped_column(String(60), default="")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    result: Mapped[dict] = mapped_column(JSONType, default=dict)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str] = mapped_column(Text, default="")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    idempotency_key: Mapped[str | None] = mapped_column(String(120), unique=True, nullable=True)


class WorkflowStep(TimestampMixin, Base):
    __tablename__ = "workflow_steps"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    step_type: Mapped[str] = mapped_column(String(40))  # brief | plan | characters | storyboard | ...
    status: Mapped[str] = mapped_column(String(20), default="approved")  # approved | rejected
    note: Mapped[str] = mapped_column(Text, default="")
    version: Mapped[int] = mapped_column(Integer, default=1)


class UsageEvent(TimestampMixin, Base):
    __tablename__ = "usage_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    provider: Mapped[str] = mapped_column(String(60))
    model: Mapped[str] = mapped_column(String(120), default="")
    usage: Mapped[dict] = mapped_column(JSONType, default=dict)
    cost: Mapped[float] = mapped_column(Float, default=0.0)


# ---------------------------------------------------------------- Long film (10 minutes to 2 hours)

class FilmProduction(TimestampMixin, Base):
    """A full-length version of a planned film: its story bible, budget and overall state (one per project)."""
    __tablename__ = "film_productions"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True, index=True)
    target_seconds: Mapped[int] = mapped_column(Integer)
    shot_seconds: Mapped[int] = mapped_column(Integer, default=8)  # one provider clip per shot
    quality: Mapped[str] = mapped_column(String(10), default="draft")
    # planning | planned | writing (scripts only) | generating | paused | budget_reached | generated | rendering | rendered | failed
    status: Mapped[str] = mapped_column(String(20), default="planning")
    story_bible: Mapped[dict] = mapped_column(JSONType, default=dict)
    budget_cap: Mapped[float] = mapped_column(Float, default=0.0)  # hard per-film cap in USD
    spent: Mapped[float] = mapped_column(Float, default=0.0)       # recorded provider cost so far
    pause_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str] = mapped_column(Text, default="")
    final_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    scenes: Mapped[list["FilmScene"]] = relationship(back_populates="production", cascade="all, delete-orphan",
                                                      order_by="FilmScene.number")


class FilmScene(TimestampMixin, Base):
    __tablename__ = "film_scenes"
    __table_args__ = (UniqueConstraint("production_id", "number", name="uq_film_scene_number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    production_id: Mapped[str] = mapped_column(ForeignKey("film_productions.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    act: Mapped[int] = mapped_column(Integer, default=1)
    title: Mapped[str] = mapped_column(String(300), default="")
    summary: Mapped[str] = mapped_column(Text, default="")          # what happens (from the outline)
    location: Mapped[str] = mapped_column(String(300), default="")
    characters: Mapped[list] = mapped_column(JSONType, default=list)
    target_seconds: Mapped[int] = mapped_column(Integer, default=60)
    script: Mapped[str] = mapped_column(Text, default="")           # written when the scene is broken into shots
    continuity: Mapped[str] = mapped_column(Text, default="")       # what's true at the end of this scene (fed to the next)
    status: Mapped[str] = mapped_column(String(20), default="planned")  # planned | generating | done | failed
    error: Mapped[str] = mapped_column(Text, default="")
    preview_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    production: Mapped[FilmProduction] = relationship(back_populates="scenes")
    shots: Mapped[list["FilmShot"]] = relationship(back_populates="scene", cascade="all, delete-orphan",
                                                   order_by="FilmShot.number")


class FilmShot(TimestampMixin, Base):
    __tablename__ = "film_shots"
    __table_args__ = (UniqueConstraint("scene_id", "number", name="uq_film_shot_number"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    scene_id: Mapped[str] = mapped_column(ForeignKey("film_scenes.id", ondelete="CASCADE"), index=True)
    number: Mapped[int] = mapped_column(Integer)
    description: Mapped[str] = mapped_column(Text, default="")
    camera: Mapped[str] = mapped_column(String(120), default="")
    movement: Mapped[str] = mapped_column(String(120), default="")
    characters: Mapped[list] = mapped_column(JSONType, default=list)
    dialogue: Mapped[list] = mapped_column(JSONType, default=list)  # [{"character", "text"}]
    seconds: Mapped[float] = mapped_column(Float, default=8.0)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | generating | done | failed
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(Text, default="")
    video_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    audio_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    frame_asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)

    scene: Mapped[FilmScene] = relationship(back_populates="shots")
