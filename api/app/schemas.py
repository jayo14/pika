from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str


class IntegrationCapability(BaseModel):
    status: Literal["configuration_required", "ready"]
    message: str
    missing_configuration: list[str] = Field(default_factory=list)
    safety_boundary: str


class CapabilityResponse(BaseModel):
    api: HealthResponse
    discord: IntegrationCapability
    workspace: IntegrationCapability


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    workspace_name: str | None = Field(default=None, max_length=120)


class SigninRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    status: str
    created_at: datetime


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_user_id: UUID
    retention_days: int
    created_at: datetime


class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    retention_days: int = Field(default=30, ge=1, le=365)


class SessionResponse(BaseModel):
    user: UserOut
    workspaces: list[WorkspaceOut]


class OAuthStartRequest(BaseModel):
    workspace_id: UUID


class OAuthStartResponse(BaseModel):
    authorize_url: str


class DiscordConnectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    discord_guild_id: str
    discord_guild_name: str | None
    status: str
    granted_at: datetime | None
    revoked_at: datetime | None
    created_at: datetime


class ConnectionChannelIn(BaseModel):
    discord_channel_id: str = Field(min_length=1, max_length=32)
    mode: Literal["allow", "deny"] = "allow"


class ConnectionChannelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    connection_id: UUID
    discord_channel_id: str
    mode: str


class MonitorCreate(BaseModel):
    workspace_id: UUID
    connection_id: UUID
    name: str = Field(min_length=1, max_length=160)
    monitor_type: str = Field(min_length=1, max_length=32)
    priority: Literal["low", "normal", "high", "critical"] = "normal"
    enabled: bool = True


class MonitorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    priority: Literal["low", "normal", "high", "critical"] | None = None
    enabled: bool | None = None


class MonitorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    connection_id: UUID
    name: str
    monitor_type: str
    priority: str
    enabled: bool
    created_at: datetime


class SignalOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    event_id: UUID
    monitor_id: UUID
    kind: str
    score: float
    explanation: dict
    status: str
    created_at: datetime


class SignalStatusUpdate(BaseModel):
    status: Literal["new", "saved", "archived"]


class SavedItemCreate(BaseModel):
    signal_id: UUID
    note: str | None = Field(default=None, max_length=4000)


class SavedItemUpdate(BaseModel):
    status: str | None = Field(default=None, max_length=32)
    note: str | None = Field(default=None, max_length=4000)


class SavedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    signal_id: UUID
    saved_by_user_id: UUID
    status: str
    note: str | None
    created_at: datetime
