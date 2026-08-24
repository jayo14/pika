from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ConnectionChannel, ConnectionStatus, DiscordConnection, Event
from app.services.ingestion import ingest_event

# Pulled out of the discord.py Client so the actual scope-enforcement decision — which
# messages Pika is authorized to touch at all — is plain, dependency-free Python that a
# unit test can exercise without a live Gateway connection or a Discord bot token.


def is_channel_allowed(allowlist: list[ConnectionChannel], channel_id: str) -> bool:
    """A channel is only in scope if an administrator explicitly listed it with mode
    "allow". Absence is deny; an explicit "deny" row is also deny. There is no implicit
    default-allow — this is the channel-allowlist boundary described in
    docs/database.md and docs/security.md."""

    return any(c.discord_channel_id == channel_id and c.mode == "allow" for c in allowlist)


async def find_active_connection(db: AsyncSession, guild_id: str) -> DiscordConnection | None:
    result = await db.execute(
        select(DiscordConnection).where(
            DiscordConnection.discord_guild_id == guild_id,
            DiscordConnection.status == ConnectionStatus.ACTIVE.value,
        )
    )
    return result.scalar_one_or_none()


async def load_channel_allowlist(db: AsyncSession, connection_id: UUID) -> list[ConnectionChannel]:
    result = await db.execute(select(ConnectionChannel).where(ConnectionChannel.connection_id == connection_id))
    return list(result.scalars().all())


async def handle_message_event(
    db: AsyncSession,
    *,
    guild_id: str,
    channel_id: str,
    message_id: str,
    author_id: str,
    author_is_bot: bool,
    content: str,
    created_at: datetime,
) -> Event | None:
    """The single authorization+ingestion decision point for a live Discord message.

    Returns None (and ingests nothing) for any message outside Pika's authorized,
    explicitly-scoped surface: no active connection for the guild, no explicit channel
    allow, or a bot-authored message (bot chatter is not the intelligence Pika surfaces
    and including it would create feedback loops with other bots in the server).
    """

    if author_is_bot:
        return None

    connection = await find_active_connection(db, guild_id)
    if connection is None:
        return None

    allowlist = await load_channel_allowlist(db, connection.id)
    if not is_channel_allowed(allowlist, channel_id):
        return None

    return await ingest_event(
        db,
        connection_id=connection.id,
        source_event_id=message_id,
        event_type="message.created",
        occurred_at=created_at,
        payload={"content": content, "author_id": author_id, "channel_id": channel_id},
    )
