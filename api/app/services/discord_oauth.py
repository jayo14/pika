from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import Settings

DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"

# Minimum permissions to read messages in explicitly allowed channels. No member-list,
# moderation, or messaging permissions are requested.
BOT_PERMISSIONS = 1024 | 65536  # VIEW_CHANNEL, READ_MESSAGE_HISTORY

# "bot" installs the administrator-approved application into a server; "identify" confirms
# who authorized it. Neither grants access to the authorizing user's personal Discord data.
OAUTH_SCOPES = "bot identify"


class DiscordOAuthError(RuntimeError):
    pass


def build_authorize_url(settings: Settings, state: str) -> str:
    if not settings.discord_client_id or not settings.discord_redirect_uri:
        raise DiscordOAuthError("Discord OAuth is not configured.")

    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": OAUTH_SCOPES,
        "permissions": str(BOT_PERMISSIONS),
        "state": state,
    }
    return f"{DISCORD_AUTHORIZE_URL}?{urlencode(params)}"


@dataclass(frozen=True)
class DiscordAuthorization:
    access_token: str
    refresh_token: str | None
    expires_in: int
    scope: str
    guild_id: str
    guild_name: str | None


async def exchange_code(settings: Settings, code: str) -> DiscordAuthorization:
    if not settings.discord_client_id or not settings.discord_client_secret or not settings.discord_redirect_uri:
        raise DiscordOAuthError("Discord OAuth is not configured.")

    data = {
        "client_id": settings.discord_client_id,
        "client_secret": settings.discord_client_secret,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.discord_redirect_uri,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(DISCORD_TOKEN_URL, data=data)

    if response.status_code != 200:
        raise DiscordOAuthError(f"Discord token exchange failed with status {response.status_code}.")

    payload = response.json()
    guild = payload.get("guild") or {}
    guild_id = guild.get("id")
    if not guild_id:
        raise DiscordOAuthError("Discord did not return an authorized server.")

    return DiscordAuthorization(
        access_token=payload["access_token"],
        refresh_token=payload.get("refresh_token"),
        expires_in=payload["expires_in"],
        scope=payload.get("scope", OAUTH_SCOPES),
        guild_id=guild_id,
        guild_name=guild.get("name"),
    )
