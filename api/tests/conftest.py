from __future__ import annotations

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.core.redis import get_redis
from app.db.session import get_engine
from app.main import app


@pytest_asyncio.fixture(autouse=True)
async def _clean_state():
    """Every test starts from an empty dev database and an empty Redis session store.

    This suite runs against the real local Postgres/Redis dev services (see api/.env),
    not a mock — the DB and queue layers are exactly what production code touches.
    """

    engine = get_engine()
    async with engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE users, workspaces, workspace_memberships, discord_connections, "
                "connection_channels, communities, monitors, monitor_rules, events, signals, "
                "saved_items, tags, saved_item_tags, notifications, audit_logs CASCADE"
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
