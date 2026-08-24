from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.billing_plans import DEFAULT_PLAN
from app.db.models import ConnectionStatus, DiscordConnection, Monitor, SearchQuery, Subscription


async def get_subscription(db: AsyncSession, workspace_id: UUID) -> Subscription | None:
    result = await db.execute(select(Subscription).where(Subscription.workspace_id == workspace_id))
    return result.scalar_one_or_none()


async def get_workspace_plan(db: AsyncSession, workspace_id: UUID) -> str:
    subscription = await get_subscription(db, workspace_id)
    return subscription.plan if subscription else DEFAULT_PLAN


async def count_monitors(db: AsyncSession, workspace_id: UUID) -> int:
    result = await db.execute(select(func.count()).select_from(Monitor).where(Monitor.workspace_id == workspace_id))
    return result.scalar_one()


async def count_active_connections(db: AsyncSession, workspace_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(DiscordConnection)
        .where(DiscordConnection.workspace_id == workspace_id, DiscordConnection.status == ConnectionStatus.ACTIVE.value)
    )
    return result.scalar_one()


async def count_saved_searches(db: AsyncSession, workspace_id: UUID) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(SearchQuery)
        .where(SearchQuery.workspace_id == workspace_id, SearchQuery.saved.is_(True))
    )
    return result.scalar_one()
