from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import NOT_FOUND, ensure_workspace_membership, get_current_user
from app.db.models import SearchQuery, User
from app.db.session import get_db
from app.schemas import SavedSearchOut, SearchRequest, SearchResponse
from app.services.search_service import search_events

router = APIRouter(tags=["search"])


@router.post("/search", response_model=SearchResponse)
async def run_search(
    payload: SearchRequest, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> SearchResponse:
    await ensure_workspace_membership(db, current_user.id, payload.workspace_id)

    results = await search_events(db, payload.workspace_id, payload.query)

    history_entry = SearchQuery(
        workspace_id=payload.workspace_id,
        created_by_user_id=current_user.id,
        query_text=payload.query,
        saved=payload.save,
    )
    db.add(history_entry)
    await db.commit()

    return SearchResponse(id=history_entry.id, query=payload.query, results=results)


@router.get("/searches", response_model=list[SavedSearchOut])
async def list_searches(
    workspace_id: UUID = Query(...),
    saved_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[SavedSearchOut]:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    query = select(SearchQuery).where(SearchQuery.workspace_id == workspace_id)
    if saved_only:
        query = query.where(SearchQuery.saved.is_(True))
    result = await db.execute(query.order_by(SearchQuery.created_at.desc()).limit(50))
    return [SavedSearchOut.model_validate(s) for s in result.scalars().all()]


@router.post("/searches/{search_id}/save", response_model=SavedSearchOut)
async def save_search(
    search_id: UUID, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> SavedSearchOut:
    search = await db.get(SearchQuery, search_id)
    if search is None:
        raise NOT_FOUND
    await ensure_workspace_membership(db, current_user.id, search.workspace_id)
    search.saved = True
    await db.commit()
    return SavedSearchOut.model_validate(search)
