from __future__ import annotations

import json
import secrets
from uuid import UUID

from app.core.redis import get_redis

SESSION_COOKIE_NAME = "pika_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days, sliding


def _session_key(session_id: str) -> str:
    return f"session:{session_id}"


async def create_session(user_id: UUID) -> str:
    session_id = secrets.token_urlsafe(32)
    redis = get_redis()
    await redis.set(_session_key(session_id), json.dumps({"user_id": str(user_id)}), ex=SESSION_TTL_SECONDS)
    return session_id


async def read_session(session_id: str) -> UUID | None:
    redis = get_redis()
    key = _session_key(session_id)
    raw = await redis.get(key)
    if raw is None:
        return None
    await redis.expire(key, SESSION_TTL_SECONDS)
    return UUID(json.loads(raw)["user_id"])


async def destroy_session(session_id: str) -> None:
    redis = get_redis()
    await redis.delete(_session_key(session_id))
