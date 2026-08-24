from __future__ import annotations

import json
import secrets
from uuid import UUID

from fastapi import Response

from app.core.config import Settings
from app.core.redis import get_redis

SESSION_COOKIE_NAME = "pika_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days, sliding


def set_session_cookie(response: Response, session_id: str, settings: Settings) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=settings.pika_env == "production",
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


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
