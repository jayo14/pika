from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, select

from app.core.config import get_settings
from app.core.redis import get_redis
from app.core.security import decrypt_secret
from app.db.models import DiscordConnection, Event, Monitor, MonitorRule, Notification, Signal
from app.db.session import get_sessionmaker
from app.services.email_service import send_email
from app.services.signal_engine import evaluate_event
from app.workers.celery_app import celery_app

logger = logging.getLogger("pika.workers")

HIGH_PRIORITY_NOTIFY_THRESHOLD = 70.0
NOTIFICATION_COOLDOWN_SECONDS = 15 * 60


async def _notification_allowed_by_cooldown(monitor_id: UUID) -> bool:
    """A monitor matching repeatedly in a burst (e.g. an active thread) should not spawn
    a Notification row for every single match — this is the "cooldown-aware delivery"
    called for in docs/database.md. `SET NX` is atomic, so concurrent workers processing
    events for the same monitor cannot both win the same cooldown window."""

    redis = get_redis()
    key = f"notify_cooldown:{monitor_id}"
    return bool(await redis.set(key, "1", nx=True, ex=NOTIFICATION_COOLDOWN_SECONDS))


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

            if evaluation.score >= HIGH_PRIORITY_NOTIFY_THRESHOLD and await _notification_allowed_by_cooldown(
                monitor.id
            ):
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


@celery_app.task(
    name="app.workers.tasks.send_password_reset_email",
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    max_retries=3,
)
def send_password_reset_email(to_email: str, reset_url: str) -> None:
    """Sends the reset link, or — with no SMTP configured — logs it at INFO so a
    developer can complete the flow locally. Same dry-run posture as the Discord Gateway
    connector with no bot token: the request that triggered this never fails either way
    (see POST /auth/password-reset/request), only the delivery channel differs."""

    settings = get_settings()
    if not settings.email_ready:
        logger.info("SMTP not configured — password reset link for %s: %s", to_email, reset_url)
        return

    send_email(
        settings,
        to=to_email,
        subject="Reset your Pika password",
        body=(
            "A password reset was requested for your Pika account.\n\n"
            f"Reset it here (expires in 30 minutes): {reset_url}\n\n"
            "If you didn't request this, you can safely ignore this email."
        ),
    )
