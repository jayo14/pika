"""The Discord Gateway connector: a separately supervised process (per
docs/architecture.md) that holds the one live websocket connection to Discord for an
administrator-installed bot and turns authorized messages into Pika events.

Run it with: `uv run python -m app.workers.gateway`

It requests only the intents this feature needs — GUILDS, GUILD_MESSAGES, and the
privileged MESSAGE_CONTENT intent (which must also be enabled for the bot in the Discord
Developer Portal). It does not request the privileged MEMBERS or PRESENCES intents, and it
never reads content outside a channel an administrator has explicitly allowed (see
app/services/gateway_ingestion.py). With no DISCORD_BOT_TOKEN configured, it logs that it
is in dry-run and exits cleanly rather than crashing — matching the startup order in
docs/setup.md ("Start workers without Discord credentials in dry-run mode").
"""

from __future__ import annotations

import logging

import discord

from app.core.config import get_settings
from app.db.session import get_sessionmaker
from app.services.gateway_ingestion import handle_message_event

logger = logging.getLogger("pika.workers.gateway")

INTENTS = discord.Intents.none()
INTENTS.guilds = True
INTENTS.guild_messages = True
INTENTS.message_content = True


class PikaGatewayClient(discord.Client):
    async def on_ready(self) -> None:
        logger.info("Gateway connected as %s, watching %d authorized guild(s)", self.user, len(self.guilds))

    async def on_message(self, message: discord.Message) -> None:
        if message.guild is None:
            return  # Pika only processes server (guild) activity, never DMs.

        session_factory = get_sessionmaker()
        async with session_factory() as db:
            try:
                event = await handle_message_event(
                    db,
                    guild_id=str(message.guild.id),
                    channel_id=str(message.channel.id),
                    message_id=str(message.id),
                    author_id=str(message.author.id),
                    author_is_bot=message.author.bot,
                    content=message.content,
                    created_at=message.created_at,
                )
            except Exception:
                logger.exception("Failed to ingest message %s in guild %s", message.id, message.guild.id)
                return

            if event is not None:
                logger.debug("Ingested event %s from guild %s", event.id, message.guild.id)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    settings = get_settings()

    if not settings.discord_bot_token:
        logger.warning(
            "DISCORD_BOT_TOKEN is not configured — the Gateway connector is running in "
            "dry-run and will not connect to Discord. Set DISCORD_BOT_TOKEN to enable it."
        )
        return

    client = PikaGatewayClient(intents=INTENTS)
    client.run(settings.discord_bot_token, log_handler=None)


if __name__ == "__main__":
    main()
