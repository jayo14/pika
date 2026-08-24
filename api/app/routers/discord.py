from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.billing_plans import get_plan_limits, within_limit
from app.core.config import Settings, get_settings
from app.core.deps import NOT_FOUND, ensure_workspace_membership, get_current_user
from app.core.oauth_state import consume_state, create_state
from app.core.security import encrypt_secret
from app.db.models import ConnectionChannel, ConnectionStatus, DiscordConnection, User
from app.db.session import get_db
from app.schemas import (
    ConnectionChannelIn,
    ConnectionChannelOut,
    DiscordConnectionOut,
    OAuthStartRequest,
    OAuthStartResponse,
)
from app.services.billing_service import count_active_connections, get_workspace_plan
from app.services.discord_oauth import DiscordOAuthError, build_authorize_url, exchange_code

router = APIRouter(tags=["discord"])

CONSENT_VERSION = "pika-discord-consent-v1"


@router.post("/discord/oauth/start", response_model=OAuthStartResponse)
async def start_oauth(
    payload: OAuthStartRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> OAuthStartResponse:
    await ensure_workspace_membership(db, current_user.id, payload.workspace_id)

    if not settings.discord_integration_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Discord integration is not configured on this server yet.",
        )

    plan = await get_workspace_plan(db, payload.workspace_id)
    limits = get_plan_limits(plan)
    used = await count_active_connections(db, payload.workspace_id)
    if not within_limit(used, limits.connections):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"The {plan} plan allows up to {limits.connections} connected server(s). Upgrade to connect more.",
        )

    state = await create_state(current_user.id, payload.workspace_id)
    return OAuthStartResponse(authorize_url=build_authorize_url(settings, state))


@router.get("/discord/oauth/callback")
async def oauth_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> RedirectResponse:
    frontend_origin = settings.cors_origins[0] if settings.cors_origins else "/"
    destination = f"{frontend_origin}/settings/integrations"

    if error or not code or not state:
        return RedirectResponse(f"{destination}?discord_status=error", status_code=status.HTTP_302_FOUND)

    identity = await consume_state(state)
    if identity is None:
        return RedirectResponse(f"{destination}?discord_status=expired", status_code=status.HTTP_302_FOUND)
    _user_id, workspace_id = identity

    try:
        authorization = await exchange_code(settings, code)
    except DiscordOAuthError:
        return RedirectResponse(f"{destination}?discord_status=error", status_code=status.HTTP_302_FOUND)

    existing = await db.execute(
        select(DiscordConnection).where(
            DiscordConnection.workspace_id == workspace_id,
            DiscordConnection.discord_guild_id == authorization.guild_id,
        )
    )
    connection = existing.scalar_one_or_none()
    now = datetime.now(UTC)
    token_expires_at = now.timestamp() + authorization.expires_in

    if connection is None:
        connection = DiscordConnection(workspace_id=workspace_id, discord_guild_id=authorization.guild_id)
        db.add(connection)

    connection.discord_guild_name = authorization.guild_name
    connection.status = ConnectionStatus.ACTIVE.value
    connection.consent_version = CONSENT_VERSION
    connection.scope = authorization.scope
    connection.access_token_ciphertext = encrypt_secret(authorization.access_token)
    connection.refresh_token_ciphertext = (
        encrypt_secret(authorization.refresh_token) if authorization.refresh_token else None
    )
    connection.token_expires_at = datetime.fromtimestamp(token_expires_at, tz=UTC)
    connection.granted_at = now
    connection.revoked_at = None
    await db.commit()

    return RedirectResponse(f"{destination}?discord_status=connected", status_code=status.HTTP_302_FOUND)


@router.get("/connections", response_model=list[DiscordConnectionOut])
async def list_connections(
    workspace_id: UUID = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DiscordConnectionOut]:
    await ensure_workspace_membership(db, current_user.id, workspace_id)
    result = await db.execute(
        select(DiscordConnection)
        .where(DiscordConnection.workspace_id == workspace_id)
        .order_by(DiscordConnection.created_at)
    )
    return [DiscordConnectionOut.model_validate(c) for c in result.scalars().all()]


async def _load_owned_connection(db: AsyncSession, current_user: User, connection_id: UUID) -> DiscordConnection:
    connection = await db.get(DiscordConnection, connection_id)
    if connection is None:
        raise NOT_FOUND
    await ensure_workspace_membership(db, current_user.id, connection.workspace_id)
    return connection


@router.post("/connections/{connection_id}/revoke", response_model=DiscordConnectionOut)
async def revoke_connection(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DiscordConnectionOut:
    connection = await _load_owned_connection(db, current_user, connection_id)
    connection.status = ConnectionStatus.REVOKED.value
    connection.revoked_at = datetime.now(UTC)
    # Data minimization: a revoked connection retains no usable secret material.
    connection.access_token_ciphertext = None
    connection.refresh_token_ciphertext = None
    await db.commit()
    return DiscordConnectionOut.model_validate(connection)


@router.get("/connections/{connection_id}/channels", response_model=list[ConnectionChannelOut])
async def list_connection_channels(
    connection_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConnectionChannelOut]:
    await _load_owned_connection(db, current_user, connection_id)
    result = await db.execute(select(ConnectionChannel).where(ConnectionChannel.connection_id == connection_id))
    return [ConnectionChannelOut.model_validate(c) for c in result.scalars().all()]


@router.put("/connections/{connection_id}/channels", response_model=list[ConnectionChannelOut])
async def replace_connection_channels(
    connection_id: UUID,
    payload: list[ConnectionChannelIn],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConnectionChannelOut]:
    """Replaces the explicit channel allowlist. Pika only ever processes events from
    channels an administrator has explicitly listed here — nothing is inferred."""

    await _load_owned_connection(db, current_user, connection_id)
    existing = await db.execute(select(ConnectionChannel).where(ConnectionChannel.connection_id == connection_id))
    for row in existing.scalars().all():
        await db.delete(row)
    await db.flush()

    channels = [
        ConnectionChannel(connection_id=connection_id, discord_channel_id=item.discord_channel_id, mode=item.mode)
        for item in payload
    ]
    db.add_all(channels)
    await db.commit()
    for channel in channels:
        await db.refresh(channel)
    return [ConnectionChannelOut.model_validate(c) for c in channels]
