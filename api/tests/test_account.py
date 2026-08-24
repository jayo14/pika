from __future__ import annotations

from sqlalchemy import select

from app.core.password_reset import consume_reset_token, create_reset_token
from app.db.models import User
from app.db.session import get_sessionmaker


async def test_password_reset_request_is_generic_for_unknown_email(client):
    response = await client.post("/api/v1/auth/password-reset/request", json={"email": "nobody@example.com"})
    assert response.status_code == 200
    assert "If an account exists" in response.json()["message"]


async def test_password_reset_request_and_known_email_return_identical_message(client):
    await client.post("/api/v1/auth/signup", json={"email": "reset-parity@example.com", "password": "correcthorsebattery"})

    known = await client.post("/api/v1/auth/password-reset/request", json={"email": "reset-parity@example.com"})
    unknown = await client.post("/api/v1/auth/password-reset/request", json={"email": "not-registered@example.com"})

    assert known.json() == unknown.json()


async def test_password_reset_confirm_changes_password_and_is_single_use(client):
    await client.post("/api/v1/auth/signup", json={"email": "reset-confirm@example.com", "password": "correcthorsebattery"})

    session_factory = get_sessionmaker()
    async with session_factory() as db:
        user = (await db.execute(select(User).where(User.email == "reset-confirm@example.com"))).scalar_one()
        token = await create_reset_token(user.id)

    confirm = await client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "brandnewpassword1"}
    )
    assert confirm.status_code == 204

    old_password_signin = await client.post(
        "/api/v1/auth/signin", json={"email": "reset-confirm@example.com", "password": "correcthorsebattery"}
    )
    assert old_password_signin.status_code == 401

    new_password_signin = await client.post(
        "/api/v1/auth/signin", json={"email": "reset-confirm@example.com", "password": "brandnewpassword1"}
    )
    assert new_password_signin.status_code == 200

    replay = await client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": "yetanotherpassword2"}
    )
    assert replay.status_code == 400


async def test_password_reset_confirm_rejects_unknown_token(client):
    response = await client.post(
        "/api/v1/auth/password-reset/confirm", json={"token": "not-a-real-token", "new_password": "brandnewpassword1"}
    )
    assert response.status_code == 400


async def test_consume_reset_token_is_one_time_use_directly():
    session_factory = get_sessionmaker()
    async with session_factory() as db:
        user = User(email="direct-token@example.com", password_hash="x")
        db.add(user)
        await db.commit()
        user_id = user.id

    token = await create_reset_token(user_id)
    first = await consume_reset_token(token)
    second = await consume_reset_token(token)

    assert first == user_id
    assert second is None


async def test_update_profile_changes_display_name(client):
    await client.post("/api/v1/auth/signup", json={"email": "profile@example.com", "password": "correcthorsebattery"})

    response = await client.patch("/api/v1/auth/me", json={"display_name": "New Name"})
    assert response.status_code == 200
    assert response.json()["user"]["display_name"] == "New Name"

    me = await client.get("/api/v1/auth/me")
    assert me.json()["user"]["display_name"] == "New Name"


async def test_update_profile_requires_authentication(client):
    response = await client.patch("/api/v1/auth/me", json={"display_name": "New Name"})
    assert response.status_code == 401


async def test_change_password_rejects_wrong_current_password(client):
    await client.post("/api/v1/auth/signup", json={"email": "change-pw@example.com", "password": "correcthorsebattery"})

    response = await client.post(
        "/api/v1/auth/change-password", json={"current_password": "wrong-password", "new_password": "brandnewpassword1"}
    )
    assert response.status_code == 401


async def test_change_password_succeeds_and_old_password_stops_working(client):
    await client.post("/api/v1/auth/signup", json={"email": "change-pw-2@example.com", "password": "correcthorsebattery"})

    response = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "correcthorsebattery", "new_password": "brandnewpassword1"},
    )
    assert response.status_code == 204

    old = await client.post("/api/v1/auth/signin", json={"email": "change-pw-2@example.com", "password": "correcthorsebattery"})
    assert old.status_code == 401

    new = await client.post("/api/v1/auth/signin", json={"email": "change-pw-2@example.com", "password": "brandnewpassword1"})
    assert new.status_code == 200


async def test_change_password_revokes_sessions_on_other_devices():
    """A password change must kill every active session for the user, not just the one
    that made the request — otherwise a session on a stolen device would survive the
    exact rotation meant to revoke it."""

    from httpx import ASGITransport, AsyncClient

    from app.main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as device_a, AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as device_b:
        await device_a.post(
            "/api/v1/auth/signup", json={"email": "multi-device@example.com", "password": "correcthorsebattery"}
        )
        await device_b.post(
            "/api/v1/auth/signin", json={"email": "multi-device@example.com", "password": "correcthorsebattery"}
        )

        assert (await device_b.get("/api/v1/auth/me")).status_code == 200

        changed = await device_a.post(
            "/api/v1/auth/change-password",
            json={"current_password": "correcthorsebattery", "new_password": "brandnewpassword1"},
        )
        assert changed.status_code == 204

        assert (await device_b.get("/api/v1/auth/me")).status_code == 401
        assert (await device_a.get("/api/v1/auth/me")).status_code == 401
