from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import require_admin
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
from app.schemas import AdminSystemHealth, AdminUserOut, AdminWorkspaceOut
from app.services.billing_service import get_workspace_plan

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminUserOut]:
    result = await db.execute(select(User).order_by(User.created_at.desc()).limit(limit).offset(offset))
    return [AdminUserOut.model_validate(u) for u in result.scalars().all()]


@router.get("/workspaces", response_model=list[AdminWorkspaceOut])
async def list_workspaces(
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> list[AdminWorkspaceOut]:
    result = await db.execute(select(Workspace).order_by(Workspace.created_at.desc()).limit(limit).offset(offset))
    workspaces = result.scalars().all()

    output: list[AdminWorkspaceOut] = []
    for workspace in workspaces:
        member_count = (
            await db.execute(
                select(func.count()).select_from(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace.id)
            )
        ).scalar_one()
        connection_count = (
            await db.execute(
                select(func.count()).select_from(DiscordConnection).where(DiscordConnection.workspace_id == workspace.id)
            )
        ).scalar_one()
        monitor_count = (
            await db.execute(select(func.count()).select_from(Monitor).where(Monitor.workspace_id == workspace.id))
        ).scalar_one()
        plan = await get_workspace_plan(db, workspace.id)

        output.append(
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
    return output


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
