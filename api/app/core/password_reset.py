from __future__ import annotations

import secrets
from uuid import UUID

from app.core.redis import get_redis

TOKEN_TTL_SECONDS = 60 * 30  # 30 minutes


def _token_key(token: str) -> str:
    return f"password_reset:{token}"


async def create_reset_token(user_id: UUID) -> str:
    token = secrets.token_urlsafe(32)
    redis = get_redis()
    await redis.set(_token_key(token), str(user_id), ex=TOKEN_TTL_SECONDS)
    return token


async def consume_reset_token(token: str) -> UUID | None:
    """One-time read: the token is deleted whether or not it is found, so a reused or
    replayed reset link can never succeed twice."""

    redis = get_redis()
    key = _token_key(token)
    raw = await redis.get(key)
    await redis.delete(key)
    if raw is None:
        return None
    return UUID(raw)
