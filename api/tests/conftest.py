from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

from dotenv import dotenv_values

# The test suite must never be able to touch whatever database/Redis a developer has
# pointed api/.env at for manual testing — an earlier version of this fixture truncated
# the *dev* database on every test run because it reused api/.env's DATABASE_URL/REDIS_URL
# verbatim, which silently wiped real accounts. This block forces the suite onto a
# dedicated `pika_test` database and Redis db 15, derived from the dev URLs' host/port so
# it still works against whatever Postgres/Redis instance the developer is running, without
# ever sharing a database name or Redis index with the dev server.
#
# It must run — and therefore this import — before anything imports app.core.config,
# since Settings() is cached on first call (see app.core.config.get_settings).

_env_path = Path(__file__).resolve().parent.parent / ".env"
_dotenv_values = dotenv_values(_env_path)


def _with_path(url: str, path: str) -> str:
    parts = urlsplit(url)
    return urlunsplit((parts.scheme, parts.netloc, path, parts.query, parts.fragment))


_dev_database_url = os.environ.get("DATABASE_URL") or _dotenv_values.get("DATABASE_URL")
_dev_redis_url = os.environ.get("REDIS_URL") or _dotenv_values.get("REDIS_URL")

if _dev_database_url:
    os.environ["DATABASE_URL"] = _with_path(_dev_database_url, "/pika_test")
if _dev_redis_url:
    os.environ["REDIS_URL"] = _with_path(_dev_redis_url, "/15")

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.redis import get_redis
from app.db.session import get_engine
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def _clean_state():
    """Every test starts from an empty `pika_test` database and Redis db 15 — never the
    dev database. `pika_test` must already exist and be migrated; see docs/setup.md.
    """

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, workspaces, workspace_memberships, discord_connections, "
                "connection_channels, communities, monitors, monitor_rules, events, signals, "
                "saved_items, tags, saved_item_tags, notifications, audit_logs, "
                "notification_preferences, searches, subscriptions CASCADE"
            )
        )
    redis = get_redis()
    await redis.flushdb()
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
