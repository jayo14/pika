from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from app.db.models import (
    ConnectionChannel,
    ConnectionStatus,
    DiscordConnection,
    Event,
    User,
    Workspace,
    WorkspaceMembership,
)
from app.db.session import get_sessionmaker
from app.services.gateway_ingestion import handle_message_event, is_channel_allowed


def test_is_channel_allowed_requires_explicit_allow_row():
    allowlist = [
        ConnectionChannel(discord_channel_id="1", mode="allow"),
        ConnectionChannel(discord_channel_id="2", mode="deny"),
    ]
    assert is_channel_allowed(allowlist, "1") is True
    assert is_channel_allowed(allowlist, "2") is False
    assert is_channel_allowed(allowlist, "3") is False  # not listed at all: still deny
    assert is_channel_allowed([], "1") is False


async def _seed_active_connection(db, *, guild_id: str, allowed_channel_id: str | None) -> DiscordConnection:
    user = User(email="gw@example.com", password_hash="x")
    db.add(user)
    await db.flush()
    workspace = Workspace(name="Gateway WS", owner_user_id=user.id)
    db.add(workspace)
    await db.flush()
    db.add(WorkspaceMembership(workspace_id=workspace.id, user_id=user.id, role="owner"))
    connection = DiscordConnection(
        workspace_id=workspace.id, discord_guild_id=guild_id, status=ConnectionStatus.ACTIVE.value, consent_version="v1"
    )
    db.add(connection)
    await db.flush()
    if allowed_channel_id is not None:
        db.add(ConnectionChannel(connection_id=connection.id, discord_channel_id=allowed_channel_id, mode="allow"))
    await db.commit()
    return connection


async def test_handle_message_event_ingests_from_allowed_channel():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        connection = await _seed_active_connection(db, guild_id="guild-1", allowed_channel_id="chan-1")

    async with session_factory() as db:
        event = await handle_message_event(
            db,
            guild_id="guild-1",
            channel_id="chan-1",
            message_id="msg-1",
            author_id="user-1",
            author_is_bot=False,
            content="looking for a designer",
            created_at=datetime.now(UTC),
        )

    assert event is not None
    async with session_factory() as db:
        stored = await db.get(Event, event.id)
        assert stored is not None
        assert stored.connection_id == connection.id


async def test_handle_message_event_skips_unlisted_channel():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        await _seed_active_connection(db, guild_id="guild-2", allowed_channel_id="chan-allowed")

    async with session_factory() as db:
        event = await handle_message_event(
            db,
            guild_id="guild-2",
            channel_id="chan-not-allowed",
            message_id="msg-2",
            author_id="user-1",
            author_is_bot=False,
            content="anything",
            created_at=datetime.now(UTC),
        )

    assert event is None
    async with session_factory() as db:
        count = (await db.execute(select(Event))).scalars().all()
        assert count == []


async def test_handle_message_event_skips_bot_authors():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        await _seed_active_connection(db, guild_id="guild-3", allowed_channel_id="chan-1")

    async with session_factory() as db:
        event = await handle_message_event(
            db,
            guild_id="guild-3",
            channel_id="chan-1",
            message_id="msg-3",
            author_id="bot-1",
            author_is_bot=True,
            content="bot chatter",
            created_at=datetime.now(UTC),
        )

    assert event is None


async def test_handle_message_event_skips_unauthorized_guild():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        event = await handle_message_event(
            db,
            guild_id="guild-unknown",
            channel_id="chan-1",
            message_id="msg-4",
            author_id="user-1",
            author_is_bot=False,
            content="anything",
            created_at=datetime.now(UTC),
        )

    assert event is None
