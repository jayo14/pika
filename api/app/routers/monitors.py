from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.billing_plans import get_plan_limits, within_limit
from app.core.deps import NOT_FOUND, ensure_workspace_membership, get_current_user
from app.db.models import DiscordConnection, Monitor, MonitorRule, User
from app.db.session import get_db
from app.schemas import MonitorCreate, MonitorOut, MonitorUpdate
from app.services.billing_service import count_monitors, get_workspace_plan

router = APIRouter(prefix="/monitors", tags=["monitors"])


async def _load_owned_monitor(db: AsyncSession, current_user: User, monitor_id: UUID) -> Monitor:
    monitor = await db.get(Monitor, monitor_id)
    if monitor is None:
        raise NOT_FOUND
    await ensure_workspace_membership(db, current_user.id, monitor.workspace_id)
    return monitor


@router.get("", response_model=list[MonitorOut])
async def list_monitors(
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[MonitorOut]:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    result = await db.execute(
        select(Monitor).where(Monitor.workspace_id == workspace_id).order_by(Monitor.created_at.desc())
    )
    return [MonitorOut.model_validate(m) for m in result.scalars().all()]


@router.post("", response_model=MonitorOut, status_code=status.HTTP_201_CREATED)
async def create_monitor(
    payload: MonitorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MonitorOut:
    await ensure_workspace_membership(db, current_user.id, payload.workspace_id)

    connection = await db.get(DiscordConnection, payload.connection_id)
    if connection is None or connection.workspace_id != payload.workspace_id:
        raise NOT_FOUND

    plan = await get_workspace_plan(db, payload.workspace_id)
    limits = get_plan_limits(plan)
    used = await count_monitors(db, payload.workspace_id)
    if not within_limit(used, limits.monitors):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"The {plan} plan allows up to {limits.monitors} monitors. Upgrade to create more.",
        )

    monitor = Monitor(
        workspace_id=payload.workspace_id,
        connection_id=payload.connection_id,
        name=payload.name,
        monitor_type=payload.monitor_type,
        priority=payload.priority,
        enabled=payload.enabled,
    )
    db.add(monitor)
    await db.flush()
    db.add(MonitorRule(monitor_id=monitor.id, field="content", operator="contains", value=payload.keyword))
    await db.commit()
    return MonitorOut.model_validate(monitor)


@router.get("/{monitor_id}", response_model=MonitorOut)
async def get_monitor(
    monitor_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> MonitorOut:
    monitor = await _load_owned_monitor(db, current_user, monitor_id)
    return MonitorOut.model_validate(monitor)


@router.patch("/{monitor_id}", response_model=MonitorOut)
async def update_monitor(
    monitor_id: UUID,
    payload: MonitorUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MonitorOut:
    monitor = await _load_owned_monitor(db, current_user, monitor_id)
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(monitor, field, value)
    await db.commit()
    return MonitorOut.model_validate(monitor)


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitor(
    monitor_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> None:
    monitor = await _load_owned_monitor(db, current_user, monitor_id)
    await db.delete(monitor)
    await db.commit()
