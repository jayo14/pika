from __future__ import annotations

from sqlalchemy import select

from app.db.models import DiscordConnection, WorkspaceMembership
from app.db.session import get_sessionmaker


async def _demote_to_member(workspace_id: str) -> None:
    """Simulates a non-owner workspace member — there is no self-service invite flow yet,
    so tests reach in directly to set up the fixture the API itself cannot produce."""

    session_factory = get_sessionmaker()
    async with session_factory() as db:
        result = await db.execute(select(WorkspaceMembership).where(WorkspaceMembership.workspace_id == workspace_id))
        membership = result.scalar_one()
        membership.role = "member"
        await db.commit()


async def test_signup_grants_owner_role(client):
    response = await client.post("/api/v1/auth/signup", json={"email": "owner@example.com", "password": "correcthorsebattery"})
    assert response.status_code == 201
    assert response.json()["workspaces"][0]["role"] == "owner"


async def test_member_cannot_start_discord_oauth(client):
    signup = await client.post("/api/v1/auth/signup", json={"email": "member-oauth@example.com", "password": "correcthorsebattery"})
    workspace_id = signup.json()["workspaces"][0]["id"]
    await _demote_to_member(workspace_id)

    response = await client.post("/api/v1/discord/oauth/start", json={"workspace_id": workspace_id})
    assert response.status_code == 403


async def test_member_cannot_revoke_connection(client):
    from datetime import UTC, datetime

    from app.db.models import ConnectionStatus

    signup = await client.post("/api/v1/auth/signup", json={"email": "member-revoke@example.com", "password": "correcthorsebattery"})
    workspace_id = signup.json()["workspaces"][0]["id"]
    await _demote_to_member(workspace_id)

    session_factory = get_sessionmaker()
    async with session_factory() as db:
        connection = DiscordConnection(
            workspace_id=workspace_id,
            discord_guild_id="1",
            status=ConnectionStatus.ACTIVE.value,
            consent_version="v1",
            granted_at=datetime.now(UTC),
        )
        db.add(connection)
        await db.commit()
        connection_id = connection.id

    response = await client.post(f"/api/v1/connections/{connection_id}/revoke")
    assert response.status_code == 403


async def test_member_cannot_change_billing_plan(client):
    signup = await client.post("/api/v1/auth/signup", json={"email": "member-billing@example.com", "password": "correcthorsebattery"})
    workspace_id = signup.json()["workspaces"][0]["id"]
    await _demote_to_member(workspace_id)

    response = await client.post(f"/api/v1/billing/plan?workspace_id={workspace_id}", json={"plan": "free"})
    assert response.status_code == 403


async def test_owner_can_change_billing_plan_to_free(client):
    signup = await client.post("/api/v1/auth/signup", json={"email": "owner-billing@example.com", "password": "correcthorsebattery"})
    workspace_id = signup.json()["workspaces"][0]["id"]

    response = await client.post(f"/api/v1/billing/plan?workspace_id={workspace_id}", json={"plan": "free"})
    assert response.status_code == 200
