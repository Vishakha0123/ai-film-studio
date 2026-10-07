"""ORM models — tables from the project report (section 27)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text
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
    # Project memory: story, characters, screenplay, scenes, shots, audio tracks (flexible → JSONB)
    memory: Mapped[dict] = mapped_column(JSONType, default=dict)

    assets: Mapped[list["Asset"]] = relationship(back_populates="project", cascade="all, delete-orphan")


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
