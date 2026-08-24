from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import NOT_FOUND, require_admin
from app.core.redis import get_redis
from app.db.models import (
    ConnectionStatus,
    DiscordConnection,
    Event,
    Monitor,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.db.session import get_db
from app.schemas import (
    AdminSystemHealth,
    AdminUserDetail,
    AdminUserListOut,
    AdminUserOut,
    AdminUserWorkspaceMembership,
    AdminWorkspaceConnection,
    AdminWorkspaceDetail,
    AdminWorkspaceListOut,
    AdminWorkspaceMember,
    AdminWorkspaceMonitor,
    AdminWorkspaceOut,
)
from app.services.billing_service import get_workspace_plan

router = APIRouter(prefix="/admin", tags=["admin"])


async def _workspace_counts(db: AsyncSession, workspace_id: UUID) -> tuple[int, int, int]:
    member_count = (
        await db.execute(select(func.count()).select_from(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id))
    ).scalar_one()
    connection_count = (
        await db.execute(select(func.count()).select_from(DiscordConnection).where(DiscordConnection.workspace_id == workspace_id))
    ).scalar_one()
    monitor_count = (
        await db.execute(select(func.count()).select_from(Monitor).where(Monitor.workspace_id == workspace_id))
    ).scalar_one()
    return member_count, connection_count, monitor_count


@router.get("/users", response_model=AdminUserListOut)
async def list_users(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=320),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUserListOut:
    query = select(User)
    count_query = select(func.count()).select_from(User)
    if q:
        query = query.where(User.email.ilike(f"%{q}%"))
        count_query = count_query.where(User.email.ilike(f"%{q}%"))

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.order_by(User.created_at.desc()).limit(limit).offset(offset))
    items = [AdminUserOut.model_validate(u) for u in result.scalars().all()]
    return AdminUserListOut(items=items, total=total)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user_detail(user_id: UUID, _admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)) -> AdminUserDetail:
    user = await db.get(User, user_id)
    if user is None:
        raise NOT_FOUND

    result = await db.execute(
        select(WorkspaceMembership, Workspace.name)
        .join(Workspace, Workspace.id == WorkspaceMembership.workspace_id)
        .where(WorkspaceMembership.user_id == user_id)
    )
    memberships = [
        AdminUserWorkspaceMembership(workspace_id=m.workspace_id, workspace_name=name, role=m.role) for m, name in result.all()
    ]

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        status=user.status,
        is_staff=user.is_staff,
        created_at=user.created_at,
        workspaces=memberships,
    )


@router.get("/workspaces", response_model=AdminWorkspaceListOut)
async def list_workspaces(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    q: str | None = Query(default=None, max_length=120),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminWorkspaceListOut:
    query = select(Workspace)
    count_query = select(func.count()).select_from(Workspace)
    if q:
        query = query.where(Workspace.name.ilike(f"%{q}%"))
        count_query = count_query.where(Workspace.name.ilike(f"%{q}%"))

    total = (await db.execute(count_query)).scalar_one()
    result = await db.execute(query.order_by(Workspace.created_at.desc()).limit(limit).offset(offset))
    workspaces = result.scalars().all()

    items: list[AdminWorkspaceOut] = []
    for workspace in workspaces:
        member_count, connection_count, monitor_count = await _workspace_counts(db, workspace.id)
        plan = await get_workspace_plan(db, workspace.id)
        items.append(
            AdminWorkspaceOut(
                id=workspace.id,
                name=workspace.name,
                owner_user_id=workspace.owner_user_id,
                retention_days=workspace.retention_days,
                created_at=workspace.created_at,
                plan=plan,
                member_count=member_count,
                connection_count=connection_count,
                monitor_count=monitor_count,
            )
        )
    return AdminWorkspaceListOut(items=items, total=total)


@router.get("/workspaces/{workspace_id}", response_model=AdminWorkspaceDetail)
async def get_workspace_detail(
    workspace_id: UUID, _admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)
) -> AdminWorkspaceDetail:
    workspace = await db.get(Workspace, workspace_id)
    if workspace is None:
        raise NOT_FOUND

    member_count, connection_count, monitor_count = await _workspace_counts(db, workspace_id)
    plan = await get_workspace_plan(db, workspace_id)

    members_result = await db.execute(
        select(WorkspaceMembership, User.email)
        .join(User, User.id == WorkspaceMembership.user_id)
        .where(WorkspaceMembership.workspace_id == workspace_id)
    )
    members = [AdminWorkspaceMember(user_id=m.user_id, email=email, role=m.role) for m, email in members_result.all()]

    connections_result = await db.execute(select(DiscordConnection).where(DiscordConnection.workspace_id == workspace_id))
    connections = [
        AdminWorkspaceConnection(id=c.id, discord_guild_id=c.discord_guild_id, discord_guild_name=c.discord_guild_name, status=c.status)
        for c in connections_result.scalars().all()
    ]

    monitors_result = await db.execute(select(Monitor).where(Monitor.workspace_id == workspace_id))
    monitors = [
        AdminWorkspaceMonitor(id=m.id, name=m.name, monitor_type=m.monitor_type, enabled=m.enabled)
        for m in monitors_result.scalars().all()
    ]

    return AdminWorkspaceDetail(
        id=workspace.id,
        name=workspace.name,
        owner_user_id=workspace.owner_user_id,
        retention_days=workspace.retention_days,
        created_at=workspace.created_at,
        plan=plan,
        member_count=member_count,
        connection_count=connection_count,
        monitor_count=monitor_count,
        members=members,
        connections=connections,
        monitors=monitors,
    )


@router.get("/system-health", response_model=AdminSystemHealth)
async def system_health(_admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)) -> AdminSystemHealth:
    try:
        await db.execute(text("SELECT 1"))
        database_status = "ok"
    except Exception:
        database_status = "error"

    try:
        await get_redis().ping()
        redis_status = "ok"
    except Exception:
        redis_status = "error"

    celery_workers_online = 0
    try:
        from app.workers.celery_app import celery_app

        pings = celery_app.control.inspect(timeout=1.0).ping() or {}
        celery_workers_online = len(pings)
    except Exception:
        celery_workers_online = 0

    total_users = (await db.execute(select(func.count()).select_from(User))).scalar_one()
    total_workspaces = (await db.execute(select(func.count()).select_from(Workspace))).scalar_one()
    total_active_connections = (
        await db.execute(
            select(func.count()).select_from(DiscordConnection).where(DiscordConnection.status == ConnectionStatus.ACTIVE.value)
        )
    ).scalar_one()
    events_pending_expiry_next_24h = (
        await db.execute(
            select(func.count())
            .select_from(Event)
            .where(Event.expires_at <= datetime.now(UTC) + timedelta(hours=24))
        )
    ).scalar_one()

    return AdminSystemHealth(
        database=database_status,
        redis=redis_status,
        celery_workers_online=celery_workers_online,
        total_users=total_users,
        total_workspaces=total_workspaces,
        total_active_connections=total_active_connections,
        events_pending_expiry_next_24h=events_pending_expiry_next_24h,
    )
