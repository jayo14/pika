from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ConnectionStatus(StrEnum):
    PENDING = "pending"
    ACTIVE = "active"
    REVOKED = "revoked"
    ERROR = "error"


class SignalStatus(StrEnum):
    NEW = "new"
    SAVED = "saved"
    ARCHIVED = "archived"


class TimestampedModel:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class User(TimestampedModel, Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    display_name: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)


class Workspace(TimestampedModel, Base):
    __tablename__ = "workspaces"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    owner_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    retention_days: Mapped[int] = mapped_column(default=30, nullable=False)


class WorkspaceMembership(TimestampedModel, Base):
    __tablename__ = "workspace_memberships"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_membership"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="member", nullable=False)


class DiscordConnection(TimestampedModel, Base):
    __tablename__ = "discord_connections"
    __table_args__ = (UniqueConstraint("workspace_id", "discord_guild_id", name="uq_workspace_guild"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    discord_guild_id: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default=ConnectionStatus.PENDING.value, nullable=False)
    consent_version: Mapped[str] = mapped_column(String(32), nullable=False)
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConnectionChannel(TimestampedModel, Base):
    __tablename__ = "connection_channels"
    __table_args__ = (UniqueConstraint("connection_id", "discord_channel_id", name="uq_connection_channel"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False)
    discord_channel_id: Mapped[str] = mapped_column(String(32), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), default="allow", nullable=False)


class Monitor(TimestampedModel, Base):
    __tablename__ = "monitors"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    monitor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="normal", nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)


class Event(TimestampedModel, Base):
    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("connection_id", "source_event_id", name="uq_connection_source_event"),
        Index("ix_events_connection_occurred", "connection_id", "occurred_at"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False)
    source_event_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)


class Signal(TimestampedModel, Base):
    __tablename__ = "signals"
    __table_args__ = (Index("ix_signals_workspace_status", "workspace_id", "status"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    event_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("events.id"), nullable=False)
    monitor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False)
    kind: Mapped[str] = mapped_column(String(64), nullable=False)
    score: Mapped[float] = mapped_column(nullable=False)
    explanation: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default=SignalStatus.NEW.value, nullable=False)


class SavedItem(TimestampedModel, Base):
    __tablename__ = "saved_items"
    __table_args__ = (UniqueConstraint("workspace_id", "signal_id", name="uq_workspace_saved_signal"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    signal_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("signals.id"), nullable=False)
    saved_by_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="open", nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
