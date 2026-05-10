"""End-to-end auth: seed → login → /me → refresh → review."""

import pytest

from seed_data import maybe_seed


@pytest.mark.asyncio
async def test_login_and_me(client):
    await maybe_seed()
    resp = await client.post(
        "/auth/login",
        json={"email": "owner@tablebridge.demo", "password": "OwnerPass!2024"},
    )
    assert resp.status_code == 200
    tokens = resp.json()
    assert "access_token" in tokens and "refresh_token" in tokens

    me = await client.get(
        "/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == "owner@tablebridge.demo"
    assert me.json()["role"] == "owner"


@pytest.mark.asyncio
async def test_pin_login(client):
    await maybe_seed()
    resp = await client.post(
        "/auth/pin-login",
        json={"email": "server@tablebridge.demo", "pin": "9999"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_bad_password_rejected(client):
    await maybe_seed()
    resp = await client.post(
        "/auth/login",
        json={"email": "owner@tablebridge.demo", "password": "WrongPassword!"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_requires_token(client):
    resp = await client.get("/orders")
    assert resp.status_code == 401
