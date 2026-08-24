from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from app.db.models import (
    ConnectionStatus,
    DiscordConnection,
    Monitor,
    MonitorRule,
    Notification,
    Signal,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.db.session import get_sessionmaker
from app.services.ingestion import ingest_event
from app.workers.tasks import _process_event_async


async def _seed_monitor(db, *, keyword: str) -> tuple:
    user = User(email="ops@example.com", password_hash="x", display_name="Ops")
    db.add(user)
    await db.flush()

    workspace = Workspace(name="Ops WS", owner_user_id=user.id, retention_days=30)
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))

    connection = DiscordConnection(
        workspace_id=workspace.id,
        discord_guild_id="guild-1",
        status=ConnectionStatus.ACTIVE.value,
        consent_version="v1",
    )
    db.add(connection)
    await db.flush()

    monitor = Monitor(
        workspace_id=workspace.id,
        connection_id=connection.id,
        name="React developer requests",
        monitor_type="opportunity",
        priority="normal",
        enabled=True,
    )
    db.add(monitor)
    await db.flush()
    db.add(MonitorRule(monitor_id=monitor.id, field="content", operator="contains", value=keyword))
    await db.commit()
    return workspace, connection, monitor


async def test_matching_event_produces_explainable_signal():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        workspace, connection, monitor = await _seed_monitor(db, keyword="react developer")

    async with session_factory() as db:
        event = await ingest_event(
            db,
            connection_id=connection.id,
            source_event_id="evt-1",
            event_type="message.created",
            occurred_at=datetime.now(UTC),
            payload={"content": "does anyone know a react developer for hire?"},
        )
        assert event is not None

    async with session_factory() as db:
        await _process_event_async(event.id)

    async with session_factory() as db:
        signals = (await db.execute(select(Signal).where(Signal.workspace_id == workspace.id))).scalars().all()

    assert len(signals) == 1
    assert signals[0].score == 60.0
    assert signals[0].explanation["matched_count"] == 1
    assert "react developer" in signals[0].explanation["reasons"][0]["value"]


async def test_non_matching_event_produces_no_signal():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        workspace, connection, _monitor = await _seed_monitor(db, keyword="react developer")

    async with session_factory() as db:
        event = await ingest_event(
            db,
            connection_id=connection.id,
            source_event_id="evt-2",
            event_type="message.created",
            occurred_at=datetime.now(UTC),
            payload={"content": "what's everyone having for lunch"},
        )
        assert event is not None

    async with session_factory() as db:
        await _process_event_async(event.id)

    async with session_factory() as db:
        signals = (await db.execute(select(Signal).where(Signal.workspace_id == workspace.id))).scalars().all()

    assert signals == []


async def test_duplicate_source_event_id_is_ignored():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        _workspace, connection, _monitor = await _seed_monitor(db, keyword="react developer")

    async with session_factory() as db:
        first = await ingest_event(
            db,
            connection_id=connection.id,
            source_event_id="evt-dup",
            event_type="message.created",
            occurred_at=datetime.now(UTC),
            payload={"content": "looking for a react developer"},
        )
        assert first is not None

    async with session_factory() as db:
        second = await ingest_event(
            db,
            connection_id=connection.id,
            source_event_id="evt-dup",
            event_type="message.created",
            occurred_at=datetime.now(UTC),
            payload={"content": "looking for a react developer"},
        )
        assert second is None


async def test_high_score_signal_creates_notification():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        user = User(email="hi@example.com", password_hash="x")
        db.add(user)
        await db.flush()
        workspace = Workspace(name="WS", owner_user_id=user.id)
        db.add(workspace)
        await db.flush()
        db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
        connection = DiscordConnection(
            workspace_id=workspace.id,
            discord_guild_id="guild-2",
            status=ConnectionStatus.ACTIVE.value,
            consent_version="v1",
        )
        db.add(connection)
        await db.flush()
        monitor = Monitor(
            workspace_id=workspace.id, connection_id=connection.id, name="M", monitor_type="opportunity", enabled=True
        )
        db.add(monitor)
        await db.flush()
        # Two matching rules pushes the score to 80, above the notify threshold.
        db.add(MonitorRule(monitor_id=monitor.id, field="content", operator="contains", value="developer"))
        db.add(MonitorRule(monitor_id=monitor.id, field="content", operator="contains", value="urgent"))
        await db.commit()

    async with session_factory() as db:
        event = await ingest_event(
            db,
            connection_id=connection.id,
            source_event_id="evt-hi",
            event_type="message.created",
            occurred_at=datetime.now(UTC),
            payload={"content": "urgent: need a developer today"},
        )

    async with session_factory() as db:
        await _process_event_async(event.id)

    async with session_factory() as db:
        notifications = (
            (await db.execute(select(Notification).where(Notification.workspace_id == workspace.id))).scalars().all()
        )

    assert len(notifications) == 1
    assert notifications[0].priority == "high"
