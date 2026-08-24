from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select

from app.core.security import decrypt_secret
from app.db.models import DiscordConnection, Event, Monitor, MonitorRule, Notification, Signal
from app.db.session import get_sessionmaker
from app.services.signal_engine import evaluate_event
from app.workers.celery_app import celery_app

logger = logging.getLogger("pika.workers")

HIGH_PRIORITY_NOTIFY_THRESHOLD = 70.0


async def _process_event_async(event_id: UUID) -> None:
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        event = await db.get(Event, event_id)
        if event is None:
            logger.warning("process_event: event %s no longer exists, skipping", event_id)
            return

        connection = await db.get(DiscordConnection, event.connection_id)
        if connection is None:
            logger.warning("process_event: connection for event %s no longer exists, skipping", event_id)
            return

        payload = json.loads(decrypt_secret(event.payload_ciphertext))

        monitors_result = await db.execute(
            select(Monitor).where(
                Monitor.workspace_id == connection.workspace_id,
                Monitor.connection_id == event.connection_id,
                Monitor.enabled.is_(True),
            )
        )
        monitors = list(monitors_result.scalars().all())

        for monitor in monitors:
            already_signaled = await db.execute(
                select(Signal.id).where(Signal.event_id == event.id, Signal.monitor_id == monitor.id)
            )
            if already_signaled.scalar_one_or_none() is not None:
                continue

            rules_result = await db.execute(select(MonitorRule).where(MonitorRule.monitor_id == monitor.id))
            rules = list(rules_result.scalars().all())

            evaluation = evaluate_event(rules, payload)
            if not evaluation.matched:
                continue

            signal = Signal(
                workspace_id=connection.workspace_id,
                event_id=event.id,
                monitor_id=monitor.id,
                kind=monitor.monitor_type,
                score=evaluation.score,
                explanation=evaluation.explanation,
            )
            db.add(signal)
            await db.flush()

            if evaluation.score >= HIGH_PRIORITY_NOTIFY_THRESHOLD:
                db.add(
                    Notification(
                        workspace_id=connection.workspace_id,
                        signal_id=signal.id,
                        priority="high" if monitor.priority == "normal" else monitor.priority,
                    )
                )

        await db.commit()


@celery_app.task(
    name="app.workers.tasks.process_event",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    max_retries=3,
)
def process_event(event_id: str) -> None:
    asyncio.run(_process_event_async(UUID(event_id)))


async def _purge_expired_events_async() -> int:
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        result = await db.execute(delete(Event).where(Event.expires_at < datetime.now(UTC)).returning(Event.id))
        deleted_ids = result.scalars().all()
        await db.commit()
        return len(deleted_ids)


@celery_app.task(name="app.workers.tasks.purge_expired_events")
def purge_expired_events() -> int:
    """Retention worker: deletes raw event payloads past their per-workspace retention
    deadline. Runs hourly via Celery beat. Derived signals are left intact — the schema
    keeps explanation evidence separate from raw event content specifically so a required
    deletion never blocks the rest of the pipeline."""

    deleted_count = asyncio.run(_purge_expired_events_async())
    if deleted_count:
        logger.info("purge_expired_events: deleted %s expired event(s)", deleted_count)
    return deleted_count
