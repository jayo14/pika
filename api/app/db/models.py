from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
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
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    is_staff: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


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
    discord_guild_name: Mapped[str | None] = mapped_column(String(160))
    status: Mapped[str] = mapped_column(String(32), default=ConnectionStatus.PENDING.value, nullable=False)
    consent_version: Mapped[str] = mapped_column(String(32), nullable=False)
    scope: Mapped[str | None] = mapped_column(String(255))
    access_token_ciphertext: Mapped[str | None] = mapped_column(Text)
    refresh_token_ciphertext: Mapped[str | None] = mapped_column(Text)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    granted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ConnectionChannel(TimestampedModel, Base):
    __tablename__ = "connection_channels"
    __table_args__ = (UniqueConstraint("connection_id", "discord_channel_id", name="uq_connection_channel"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False)
    discord_channel_id: Mapped[str] = mapped_column(String(32), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), default="allow", nullable=False)


class Community(TimestampedModel, Base):
    __tablename__ = "communities"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False, unique=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(64))
    listing_status: Mapped[str] = mapped_column(String(32), default="unlisted", nullable=False)


class Monitor(TimestampedModel, Base):
    __tablename__ = "monitors"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    monitor_type: Mapped[str] = mapped_column(String(32), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="normal", nullable=False)
    enabled: Mapped[bool] = mapped_column(default=True, nullable=False)


class MonitorRule(TimestampedModel, Base):
    __tablename__ = "monitor_rules"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    monitor_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("monitors.id"), nullable=False, index=True)
    field: Mapped[str] = mapped_column(String(64), nullable=False)
    operator: Mapped[str] = mapped_column(String(32), nullable=False)
    value: Mapped[str] = mapped_column(String(500), nullable=False)


class Event(TimestampedModel, Base):
    __tablename__ = "events"
    __table_args__ = (
        UniqueConstraint("connection_id", "source_event_id", name="uq_connection_source_event"),
        Index("ix_events_connection_occurred", "connection_id", "occurred_at"),
        Index("ix_events_search_vector", "search_vector", postgresql_using="gin"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    connection_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("discord_connections.id"), nullable=False)
    source_event_id: Mapped[str] = mapped_column(String(64), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    payload_ciphertext: Mapped[str] = mapped_column(Text, nullable=False)
    # Derived search index built from decrypted content at ingestion time. It is not raw
    # content — deletion/retention jobs clear it alongside payload_ciphertext (see the
    # retention worker), so a purged event leaves nothing searchable behind.
    search_vector: Mapped[str | None] = mapped_column(TSVECTOR)


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


class Tag(TimestampedModel, Base):
    __tablename__ = "tags"
    __table_args__ = (UniqueConstraint("workspace_id", "name", name="uq_workspace_tag_name"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(64), nullable=False)


class SavedItemTag(Base):
    __tablename__ = "saved_item_tags"
    __table_args__ = (UniqueConstraint("saved_item_id", "tag_id", name="uq_saved_item_tag"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    saved_item_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("saved_items.id"), nullable=False)
    tag_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("tags.id"), nullable=False)


class Notification(TimestampedModel, Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_workspace_read", "workspace_id", "read_at"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    signal_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("signals.id"), nullable=False)
    priority: Mapped[str] = mapped_column(String(16), default="normal", nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuditLog(TimestampedModel, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_workspace_created", "workspace_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    actor_user_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True))
    audit_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)


class NotificationPreference(TimestampedModel, Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_notification_preference_member"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    min_priority: Mapped[str] = mapped_column(String(16), default="low", nullable=False)
    in_app_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SearchQuery(TimestampedModel, Base):
    __tablename__ = "searches"
    __table_args__ = (Index("ix_searches_workspace_created", "workspace_id", "created_at"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False)
    created_by_user_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    query_text: Mapped[str] = mapped_column(String(500), nullable=False)
    saved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Subscription(TimestampedModel, Base):
    __tablename__ = "subscriptions"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, unique=True
    )
    plan: Mapped[str] = mapped_column(String(32), default="free", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_customer_id: Mapped[str | None] = mapped_column(String(128))
    external_subscription_id: Mapped[str | None] = mapped_column(String(128))
