from __future__ import annotations

from redis.asyncio import Redis

from app.core.config import get_settings

_client: Redis | None = None


def get_redis() -> Redis:
    global _client
    if _client is None:
        settings = get_settings()
        if not settings.redis_url:
            raise RuntimeError("REDIS_URL is not configured.")
        _client = Redis.from_url(settings.redis_url, decode_responses=True)
    return _client
