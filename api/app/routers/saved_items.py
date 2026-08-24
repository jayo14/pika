from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import NOT_FOUND, ensure_workspace_membership, get_current_user
from app.db.models import SavedItem, User
from app.db.session import get_db
from app.schemas import SavedItemOut, SavedItemUpdate

router = APIRouter(prefix="/saved-items", tags=["saved-items"])


@router.get("", response_model=list[SavedItemOut])
async def list_saved_items(
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SavedItemOut]:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    result = await db.execute(
        select(SavedItem).where(SavedItem.workspace_id == workspace_id).order_by(SavedItem.created_at.desc())
    )
    return [SavedItemOut.model_validate(s) for s in result.scalars().all()]


@router.patch("/{saved_item_id}", response_model=SavedItemOut)
async def update_saved_item(
    saved_item_id: UUID,
    payload: SavedItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SavedItemOut:
    saved_item = await db.get(SavedItem, saved_item_id)
    if saved_item is None:
        raise NOT_FOUND
    await ensure_workspace_membership(db, current_user.id, saved_item.workspace_id)

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(saved_item, field, value)
    await db.commit()
    return SavedItemOut.model_validate(saved_item)
