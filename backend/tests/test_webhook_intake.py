"""Webhook intake — HMAC verification, replay protection, idempotency."""

import json
from datetime import UTC, datetime

import pytest

from app.config import get_settings
from app.security import sign_payload
from seed_data import maybe_seed

settings = get_settings()


def _doordash_payload():
    return {
        "order_id": "DD-IDEMP-1",
        "external_delivery_id": "DD-DELIV-1",
        "status": "ACCEPTED",
        "created_at": datetime.now(UTC).isoformat(),
        "pickup_time": datetime.now(UTC).isoformat(),
        "customer": {"first_name": "Test", "last_name": "User"},
        "items": [
            {"id": 1, "name": "Burger", "quantity": 1, "price": 1200, "modifiers": []}
        ],
        "order_total": 1200,
    }


@pytest.mark.asyncio
async def test_valid_signature_accepted(client):
    await maybe_seed()
    body = json.dumps(_doordash_payload()).encode()
    sig = sign_payload(body, settings.doordash_webhook_secret)
    ts = str(int(datetime.now(UTC).timestamp()))
    resp = await client.post(
        "/webhooks/doordash",
        content=body,
        headers={
            "Content-Type": "application/json",
            "X-DoorDash-Signature": sig,
            "X-DoorDash-Timestamp": ts,
        },
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "accepted"


@pytest.mark.asyncio
async def test_bad_signature_rejected(client):
    await maybe_seed()
    body = json.dumps(_doordash_payload()).encode()
    ts = str(int(datetime.now(UTC).timestamp()))
    resp = await client.post(
        "/webhooks/doordash",
        content=body,
        headers={
            "X-DoorDash-Signature": "sha256=deadbeef",
            "X-DoorDash-Timestamp": ts,
        },
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_replay_window_rejected(client):
    await maybe_seed()
    body = json.dumps(_doordash_payload()).encode()
    sig = sign_payload(body, settings.doordash_webhook_secret)
    old_ts = str(int(datetime.now(UTC).timestamp()) - 3600)
    resp = await client.post(
        "/webhooks/doordash",
        content=body,
        headers={"X-DoorDash-Signature": sig, "X-DoorDash-Timestamp": old_ts},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_idempotent_duplicate_is_ignored(client):
    await maybe_seed()
    payload = _doordash_payload()
    body = json.dumps(payload).encode()
    sig = sign_payload(body, settings.doordash_webhook_secret)
    ts = str(int(datetime.now(UTC).timestamp()))
    headers = {"X-DoorDash-Signature": sig, "X-DoorDash-Timestamp": ts}

    a = await client.post("/webhooks/doordash", content=body, headers=headers)
    b = await client.post("/webhooks/doordash", content=body, headers=headers)
    assert a.status_code == 200
    assert b.status_code == 200
    assert b.json()["status"] == "duplicate"
