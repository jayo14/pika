from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import NOT_FOUND, ensure_workspace_membership, get_current_user
from app.db.models import SavedItem, Signal, User
from app.db.session import get_db
from app.schemas import SavedItemOut, SignalOut, SignalStatusUpdate

router = APIRouter(prefix="/signals", tags=["signals"])


async def _load_owned_signal(db: AsyncSession, current_user: User, signal_id: UUID) -> Signal:
    signal = await db.get(Signal, signal_id)
    if signal is None:
        raise NOT_FOUND
    await ensure_workspace_membership(db, current_user.id, signal.workspace_id)
    return signal


@router.get("", response_model=list[SignalOut])
async def list_signals(
    workspace_id: UUID = Query(...),
    status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SignalOut]:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    query = select(Signal).where(Signal.workspace_id == workspace_id)
    if status is not None:
        query = query.where(Signal.status == status)
    result = await db.execute(query.order_by(Signal.created_at.desc()))
    return [SignalOut.model_validate(s) for s in result.scalars().all()]


@router.get("/{signal_id}", response_model=SignalOut)
async def get_signal(
    signal_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> SignalOut:
    signal = await _load_owned_signal(db, current_user, signal_id)
    return SignalOut.model_validate(signal)


@router.patch("/{signal_id}", response_model=SignalOut)
async def update_signal_status(
    signal_id: UUID,
    payload: SignalStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SignalOut:
    signal = await _load_owned_signal(db, current_user, signal_id)
    signal.status = payload.status
    await db.commit()
    return SignalOut.model_validate(signal)


@router.post("/{signal_id}/save", response_model=SavedItemOut, status_code=status.HTTP_201_CREATED)
async def save_signal(
    signal_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> SavedItemOut:
    signal = await _load_owned_signal(db, current_user, signal_id)

    existing = await db.execute(
        select(SavedItem).where(SavedItem.workspace_id == signal.workspace_id, SavedItem.signal_id == signal_id)
    )
    saved_item = existing.scalar_one_or_none()
    if saved_item is None:
        saved_item = SavedItem(
            workspace_id=signal.workspace_id,
            signal_id=signal_id,
            saved_by_user_id=current_user.id,
            status="open",
        )
        db.add(saved_item)

    signal.status = "saved"
    await db.commit()
    return SavedItemOut.model_validate(saved_item)
