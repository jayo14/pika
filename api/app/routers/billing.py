from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.billing_plans import get_plan_limits
from app.core.config import Settings, get_settings
from app.core.deps import ensure_workspace_membership, ensure_workspace_role, get_current_user
from app.db.models import Subscription, User
from app.db.session import get_db
from app.schemas import PlanChangeRequest, SubscriptionOut, UsageOut
from app.services.billing_service import (
    count_active_connections,
    count_monitors,
    count_saved_searches,
    get_subscription,
)

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/subscription", response_model=SubscriptionOut)
async def get_workspace_subscription(
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionOut:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    subscription = await get_subscription(db, workspace_id)
    if subscription is None:
        # No row yet: the workspace is implicitly on the free plan until it changes.
        return SubscriptionOut(workspace_id=workspace_id, plan="free", status="active", current_period_end=None)
    return SubscriptionOut.model_validate(subscription)


@router.get("/usage", response_model=UsageOut)
async def get_workspace_usage(
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UsageOut:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    subscription = await get_subscription(db, workspace_id)
    plan = subscription.plan if subscription else "free"

    return UsageOut(
        workspace_id=workspace_id,
        plan=plan,
        limits=get_plan_limits(plan),
        monitors_used=await count_monitors(db, workspace_id),
        connections_used=await count_active_connections(db, workspace_id),
        saved_searches_used=await count_saved_searches(db, workspace_id),
    )


@router.post("/plan", response_model=SubscriptionOut)
async def change_plan(
    payload: PlanChangeRequest,
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SubscriptionOut:
    # Billing affects the whole workspace's spend — only an owner can change plan.
    await ensure_workspace_role(db, current_user.id, workspace_id, min_role="owner")

    if payload.plan != "free" and not settings.billing_provider_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="A payment provider is not configured on this server, so paid plans cannot be activated yet.",
        )

    subscription = await get_subscription(db, workspace_id)
    if subscription is None:
        subscription = Subscription(workspace_id=workspace_id, plan=payload.plan)
        db.add(subscription)
    else:
        subscription.plan = payload.plan
    await db.commit()
    return SubscriptionOut.model_validate(subscription)
