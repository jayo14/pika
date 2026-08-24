from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decrypt_secret
from app.db.models import DiscordConnection, Event
from app.schemas import SearchResultItem

MAX_RESULTS = 25
SNIPPET_LENGTH = 240


def _snippet(content: str) -> str:
    if len(content) <= SNIPPET_LENGTH:
        return content
    return content[:SNIPPET_LENGTH].rsplit(" ", 1)[0] + "…"


async def search_events(db: AsyncSession, workspace_id: UUID, query_text: str) -> list[SearchResultItem]:
    """PostgreSQL full-text search over authorized, workspace-scoped event content.

    Uses `plainto_tsquery` (not raw `to_tsquery`) so user input can never be interpreted
    as tsquery operator syntax. Matches docs/architecture.md's decision to start with
    PostgreSQL full-text search rather than a dedicated search engine.
    """

    ts_query = func.plainto_tsquery("english", query_text)
    rank = func.ts_rank(Event.search_vector, ts_query).label("rank")

    result = await db.execute(
        select(Event, rank)
        .join(DiscordConnection, DiscordConnection.id == Event.connection_id)
        .where(DiscordConnection.workspace_id == workspace_id, Event.search_vector.op("@@")(ts_query))
        .order_by(rank.desc())
        .limit(MAX_RESULTS)
    )
    rows = result.all()

    items: list[SearchResultItem] = []
    for event, rank_value in rows:
        payload = json.loads(decrypt_secret(event.payload_ciphertext))
        content = str(payload.get("content", ""))
        items.append(
            SearchResultItem(
                event_id=event.id,
                connection_id=event.connection_id,
                event_type=event.event_type,
                occurred_at=event.occurred_at,
                snippet=_snippet(content),
                rank=float(rank_value),
            )
        )
    return items
