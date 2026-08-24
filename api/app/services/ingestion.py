from __future__ import annotations

import json
from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import encrypt_secret
from app.db.models import DiscordConnection, Event, Workspace
from app.services.exceptions import ConnectionNotFoundError


async def ingest_event(
    db: AsyncSession,
    *,
    connection_id: UUID,
    source_event_id: str,
    event_type: str,
    occurred_at: datetime,
    payload: dict,
) -> Event | None:
    """Persist a minimal, encrypted, retention-bound normalized event for an authorized
    connection. Called by the Gateway worker — never by an unauthenticated caller.

    Returns None if this event was already ingested (idempotent on
    (connection_id, source_event_id)), so the caller can safely retry delivery.
    """

    existing = await db.execute(
        select(Event).where(Event.connection_id == connection_id, Event.source_event_id == source_event_id)
    )
    if existing.scalar_one_or_none() is not None:
        return None

    connection = await db.get(DiscordConnection, connection_id)
    if connection is None:
        raise ConnectionNotFoundError(str(connection_id))

    workspace = await db.get(Workspace, connection.workspace_id)
    retention_days = workspace.retention_days if workspace else 30

    event = Event(
        connection_id=connection_id,
        source_event_id=source_event_id,
        event_type=event_type,
        occurred_at=occurred_at,
        expires_at=occurred_at + timedelta(days=retention_days),
        payload_ciphertext=encrypt_secret(json.dumps(payload)),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    from app.workers.tasks import process_event  # local import avoids a module-load cycle

    process_event.delay(str(event.id))
    return event
