from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import NOT_FOUND, ensure_workspace_membership, get_current_user
from app.db.models import Notification, NotificationPreference, User
from app.db.session import get_db
from app.schemas import NotificationOut, NotificationPreferenceOut, NotificationPreferenceUpdate
from app.services.notification_priority import PRIORITY_ORDER

router = APIRouter(tags=["notifications"])


async def _get_or_default_preference(db: AsyncSession, workspace_id: UUID, user_id: UUID) -> NotificationPreference:
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.workspace_id == workspace_id, NotificationPreference.user_id == user_id
        )
    )
    preference = result.scalar_one_or_none()
    if preference is not None:
        return preference
    return NotificationPreference(workspace_id=workspace_id, user_id=user_id, min_priority="low", in_app_enabled=True)


@router.get("/notification-preferences", response_model=NotificationPreferenceOut)
async def get_notification_preference(
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceOut:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    preference = await _get_or_default_preference(db, workspace_id, current_user.id)
    return NotificationPreferenceOut.model_validate(preference)


@router.put("/notification-preferences", response_model=NotificationPreferenceOut)
async def update_notification_preference(
    payload: NotificationPreferenceUpdate,
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPreferenceOut:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.workspace_id == workspace_id, NotificationPreference.user_id == current_user.id
        )
    )
    preference = result.scalar_one_or_none()
    if preference is None:
        preference = NotificationPreference(workspace_id=workspace_id, user_id=current_user.id)
        db.add(preference)
    preference.min_priority = payload.min_priority
    preference.in_app_enabled = payload.in_app_enabled
    await db.commit()
    return NotificationPreferenceOut.model_validate(preference)


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    workspace_id: UUID = Query(...),
    unread_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NotificationOut]:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    preference = await _get_or_default_preference(db, workspace_id, current_user.id)

    if not preference.in_app_enabled:
        return []

    query = select(Notification).where(Notification.workspace_id == workspace_id)
    if unread_only:
        query = query.where(Notification.read_at.is_(None))
    result = await db.execute(query.order_by(Notification.created_at.desc()))
    notifications = result.scalars().all()

    min_rank = PRIORITY_ORDER[preference.min_priority]
    visible = [n for n in notifications if PRIORITY_ORDER.get(n.priority, 1) >= min_rank]
    return [NotificationOut.model_validate(n) for n in visible]


@router.patch("/notifications/{notification_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationOut:
    notification = await db.get(Notification, notification_id)
    if notification is None:
        raise NOT_FOUND
    await ensure_workspace_membership(db, current_user.id, notification.workspace_id)
    notification.read_at = datetime.now(UTC)
    await db.commit()
    return NotificationOut.model_validate(notification)
