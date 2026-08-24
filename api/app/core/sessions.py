from __future__ import annotations

import json
import secrets
from uuid import UUID

from fastapi import Response

from app.core.config import Settings
from app.core.redis import get_redis

SESSION_COOKIE_NAME = "pika_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days, sliding


def _cookie_security(settings: Settings) -> tuple[bool, str]:
    """The client and API are same-origin in local dev (Vite proxies /api, see
    vite.config.ts) but are two different HTTPS origins in the Docker/Render deployment
    topology (e.g. a static site plus a separate API service). A `lax` cookie is not sent
    on cross-origin fetches at all, which would silently break every authenticated
    request, so production uses `SameSite=None` — which browsers require pairing with
    `Secure`, which Render's HTTPS-by-default origins satisfy."""

    if settings.pika_env == "production":
        return True, "none"
    return False, "lax"


def set_session_cookie(response: Response, session_id: str, settings: Settings) -> None:
    secure, samesite = _cookie_security(settings)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    secure, samesite = _cookie_security(settings)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/", secure=secure, samesite=samesite)


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
