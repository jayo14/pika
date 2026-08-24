from __future__ import annotations

import json
import secrets
from uuid import UUID

from app.core.redis import get_redis

STATE_TTL_SECONDS = 60 * 10


def _state_key(state: str) -> str:
    return f"discord_oauth_state:{state}"


async def create_state(user_id: UUID, workspace_id: UUID) -> str:
    state = secrets.token_urlsafe(24)
    redis = get_redis()
    await redis.set(
        _state_key(state),
        json.dumps({"user_id": str(user_id), "workspace_id": str(workspace_id)}),
        ex=STATE_TTL_SECONDS,
    )
    return state


async def consume_state(state: str) -> tuple[UUID, UUID] | None:
    """One-time read: the state is deleted whether or not it is found, so a replayed
    callback (e.g. a re-submitted browser form) cannot reuse it."""

    redis = get_redis()
    key = _state_key(state)
    raw = await redis.get(key)
    await redis.delete(key)
    if raw is None:
        return None
    data = json.loads(raw)
    return UUID(data["user_id"]), UUID(data["workspace_id"])
