"""Mock Grubhub platform — generates realistic webhook payloads."""

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.security import sign_payload

settings = get_settings()

PLATFORM = "grubhub"

DINERS = [
    {"first_name": "Avery", "last_name": "Nguyen"},
    {"first_name": "Quinn", "last_name": "Reyes"},
    {"first_name": "Hayden", "last_name": "Kim"},
    {"first_name": "Reese", "last_name": "Cohen"},
]


def _mk_order(menu_pool: list[dict[str, Any]]) -> dict[str, Any]:
    items = random.sample(menu_pool, k=min(len(menu_pool), random.randint(1, 4)))
    diner = random.choice(DINERS)
    return {
        "order_uuid": str(uuid.uuid4()),
        "short_id": f"GH-{random.randint(10000, 99999)}",
        "state": "RECEIVED",
        "order_placed_time": datetime.now(UTC).isoformat(),
        "expected_time": (datetime.now(UTC) + timedelta(minutes=random.randint(20, 60))).isoformat(),
        "diner": diner,
        "lines": [
            {
                "menu_item_id": str(item["id"]),
                "name": item["name"],
                "quantity": random.randint(1, 2),
                "item_price_cents": int(item["price"] * 100),
                "options": [
                    {"name": m, "option_id": f"opt-{uuid.uuid4().hex[:6]}"}
                    for m in item.get("modifiers", [])
                ],
                "special_instructions": item.get("note"),
            }
            for item in items
        ],
        "instructions": random.choice(
            [
                None,
                "Gluten-free if possible",
                "Sub fries with side salad",
                "EXTRA hot sauce",
                "Cut sandwich in half",
                "No tomato — allergy",
            ]
        ),
    }


async def push_order_to_webhook(
    base_url: str, menu_pool: list[dict[str, Any]]
) -> dict[str, Any]:
    payload = _mk_order(menu_pool)
    body = json.dumps(payload).encode()
    signature = sign_payload(body, settings.grubhub_webhook_secret)
    timestamp = str(int(datetime.now(UTC).timestamp()))
    headers = {
        "Content-Type": "application/json",
        "X-Grubhub-Signature": signature,
        "X-Grubhub-Timestamp": timestamp,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{base_url}/webhooks/grubhub", content=body, headers=headers)
        resp.raise_for_status()
    return payload


async def update_item_availability(item_id: int, available: bool) -> dict[str, Any]:
    return {
        "platform": PLATFORM,
        "item_id": item_id,
        "available": available,
        "updated_at": datetime.now(UTC).isoformat(),
        "status": "ok",
    }


def normalize(payload: dict[str, Any]) -> dict[str, Any]:
    diner = payload.get("diner", {})
    return {
        "platform": PLATFORM,
        "external_order_id": payload["order_uuid"],
        "customer_name": f"{diner.get('first_name', '')} {diner.get('last_name', '')}".strip(),
        "placed_at": payload["order_placed_time"],
        "pickup_time": payload.get("expected_time"),
        "items": [
            {
                "raw_name": ln["name"],
                "quantity": ln["quantity"],
                "raw_modifiers": [opt["name"] for opt in ln.get("options", [])],
                "raw_special_instructions": ln.get("special_instructions"),
                "unit_price": ln.get("item_price_cents", 0) / 100,
            }
            for ln in payload.get("lines", [])
        ],
        "raw_special_instructions": payload.get("instructions"),
        "raw_payload": payload,
    }
