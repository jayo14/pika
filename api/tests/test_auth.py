from __future__ import annotations


async def test_signup_creates_user_and_default_workspace(client):
    response = await client.post(
        "/api/v1/auth/signup", json={"email": "founder@example.com", "password": "correcthorsebattery"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["user"]["email"] == "founder@example.com"
    assert len(body["workspaces"]) == 1
    assert "pika_session" in response.cookies


async def test_signup_rejects_duplicate_email(client):
    payload = {"email": "dup@example.com", "password": "correcthorsebattery"}
    first = await client.post("/api/v1/auth/signup", json=payload)
    assert first.status_code == 201

    second = await client.post("/api/v1/auth/signup", json=payload)
    assert second.status_code == 409


async def test_signin_rejects_wrong_password(client):
    await client.post("/api/v1/auth/signup", json={"email": "signin@example.com", "password": "correcthorsebattery"})

    response = await client.post(
        "/api/v1/auth/signin", json={"email": "signin@example.com", "password": "wrong-password"}
    )
    assert response.status_code == 401


async def test_me_requires_authentication(client):
    response = await client.get("/api/v1/auth/me")
    assert response.status_code == 401


async def test_signout_invalidates_session(client):
    await client.post("/api/v1/auth/signup", json={"email": "signout@example.com", "password": "correcthorsebattery"})

    assert (await client.get("/api/v1/auth/me")).status_code == 200

    signout = await client.post("/api/v1/auth/signout")
    assert signout.status_code == 204

    assert (await client.get("/api/v1/auth/me")).status_code == 401
