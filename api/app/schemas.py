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
    email: IntegrationCapability


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str | None = Field(default=None, max_length=120)
    workspace_name: str | None = Field(default=None, max_length=120)


class SigninRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=1, max_length=200)
    new_password: str = Field(min_length=10, max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=10, max_length=128)


class ProfileUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)


class MessageResponse(BaseModel):
    message: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    status: str
    is_staff: bool
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


class WorkspaceMembershipOut(WorkspaceOut):
    role: Literal["owner", "member"]


class SessionResponse(BaseModel):
    user: UserOut
    workspaces: list[WorkspaceMembershipOut]


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
    keyword: str = Field(min_length=1, max_length=200, description="Content this monitor watches for (V1: a single contains-keyword rule).")


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


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    signal_id: UUID
    priority: str
    delivered_at: datetime | None
    read_at: datetime | None
    created_at: datetime


class NotificationPreferenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: UUID
    min_priority: Literal["low", "normal", "high", "critical"]
    in_app_enabled: bool


class NotificationPreferenceUpdate(BaseModel):
    min_priority: Literal["low", "normal", "high", "critical"] = "low"
    in_app_enabled: bool = True


class SearchRequest(BaseModel):
    workspace_id: UUID
    query: str = Field(min_length=1, max_length=500)
    save: bool = False


class SearchResultItem(BaseModel):
    event_id: UUID
    connection_id: UUID
    event_type: str
    occurred_at: datetime
    snippet: str
    rank: float


class SearchResponse(BaseModel):
    id: UUID
    query: str
    results: list[SearchResultItem]


class SavedSearchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    query_text: str
    saved: bool
    created_at: datetime


class SubscriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    workspace_id: UUID
    plan: str
    status: str
    current_period_end: datetime | None


class PlanLimits(BaseModel):
    plan: str
    monitors: int | None
    connections: int | None
    saved_searches: int | None
    retention_days: int
    price_usd_per_month: float


class UsageOut(BaseModel):
    workspace_id: UUID
    plan: str
    limits: PlanLimits
    monitors_used: int
    connections_used: int
    saved_searches_used: int


class PlanChangeRequest(BaseModel):
    plan: Literal["free", "pro", "business"]


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    display_name: str | None
    status: str
    is_staff: bool
    created_at: datetime


class AdminWorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    owner_user_id: UUID
    retention_days: int
    created_at: datetime
    plan: str
    member_count: int
    connection_count: int
    monitor_count: int


class AdminUserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int


class AdminWorkspaceListOut(BaseModel):
    items: list[AdminWorkspaceOut]
    total: int


class AdminUserWorkspaceMembership(BaseModel):
    workspace_id: UUID
    workspace_name: str
    role: str


class AdminUserDetail(AdminUserOut):
    workspaces: list[AdminUserWorkspaceMembership]


class AdminWorkspaceMember(BaseModel):
    user_id: UUID
    email: str
    role: str


class AdminWorkspaceConnection(BaseModel):
    id: UUID
    discord_guild_id: str
    discord_guild_name: str | None
    status: str


class AdminWorkspaceMonitor(BaseModel):
    id: UUID
    name: str
    monitor_type: str
    enabled: bool


class AdminWorkspaceDetail(AdminWorkspaceOut):
    members: list[AdminWorkspaceMember]
    connections: list[AdminWorkspaceConnection]
    monitors: list[AdminWorkspaceMonitor]


class AdminSystemHealth(BaseModel):
    database: Literal["ok", "error"]
    redis: Literal["ok", "error"]
    celery_workers_online: int
    total_users: int
    total_workspaces: int
    total_active_connections: int
    events_pending_expiry_next_24h: int


class SavedItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workspace_id: UUID
    signal_id: UUID
    saved_by_user_id: UUID
    status: str
    note: str | None
    created_at: datetime
