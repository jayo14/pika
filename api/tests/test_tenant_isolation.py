from __future__ import annotations

from httpx import ASGITransport, AsyncClient

from app.main import app


async def _signup(email: str) -> tuple[AsyncClient, str]:
    client = AsyncClient(transport=ASGITransport(app=app), base_url="http://test")
    response = await client.post("/api/v1/auth/signup", json={"email": email, "password": "correcthorsebattery"})
    workspace_id = response.json()["workspaces"][0]["id"]
    return client, workspace_id


async def test_workspace_read_is_scoped_to_member(client):
    owner, owner_ws = await _signup("owner@example.com")
    outsider, _outsider_ws = await _signup("outsider@example.com")

    own_read = await owner.get(f"/api/v1/workspaces/{owner_ws}")
    assert own_read.status_code == 200

    cross_read = await outsider.get(f"/api/v1/workspaces/{owner_ws}")
    assert cross_read.status_code == 404

    await owner.aclose()
    await outsider.aclose()


async def test_monitor_list_is_scoped_to_member(client):
    owner, owner_ws = await _signup("owner2@example.com")
    outsider, _outsider_ws = await _signup("outsider2@example.com")

    own_list = await owner.get("/api/v1/monitors", params={"workspace_id": owner_ws})
    assert own_list.status_code == 200

    cross_list = await outsider.get("/api/v1/monitors", params={"workspace_id": owner_ws})
    assert cross_list.status_code == 404

    await owner.aclose()
    await outsider.aclose()


async def test_saved_items_list_is_scoped_to_member(client):
    owner, owner_ws = await _signup("owner3@example.com")
    outsider, _outsider_ws = await _signup("outsider3@example.com")

    cross_list = await outsider.get("/api/v1/saved-items", params={"workspace_id": owner_ws})
    assert cross_list.status_code == 404

    await owner.aclose()
    await outsider.aclose()


async def test_signals_list_requires_authentication(client):
    response = await client.get("/api/v1/signals", params={"workspace_id": "00000000-0000-0000-0000-000000000000"})
    assert response.status_code == 401
