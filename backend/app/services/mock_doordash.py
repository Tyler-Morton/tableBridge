"""Mock DoorDash platform — generates realistic webhook payloads."""

import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.security import sign_payload

settings = get_settings()

PLATFORM = "doordash"

# Mirror DoorDash's drive-orders schema as closely as possible.
SAMPLE_NAMES = ["Alex M.", "Jamie L.", "Pat S.", "Taylor W.", "Morgan R."]


def _mk_order(menu_pool: list[dict[str, Any]]) -> dict[str, Any]:
    items = random.sample(menu_pool, k=min(len(menu_pool), random.randint(1, 4)))
    return {
        "order_id": f"DD-{uuid.uuid4().hex[:10].upper()}",
        "external_delivery_id": f"DD-DELIV-{uuid.uuid4().hex[:8]}",
        "status": "ACCEPTED",
        "created_at": datetime.now(UTC).isoformat(),
        "pickup_time": (datetime.now(UTC) + timedelta(minutes=random.randint(20, 50))).isoformat(),
        "customer": {
            "first_name": random.choice(SAMPLE_NAMES).split()[0],
            "last_name": random.choice(SAMPLE_NAMES).split()[-1],
            "phone": "+1XXXXXXXXXX",
        },
        "items": [
            {
                "id": item["id"],
                "name": item["name"],
                "quantity": random.randint(1, 2),
                "price": int(item["price"] * 100),  # cents
                "modifiers": [{"name": m} for m in item.get("modifiers", [])],
                "special_instructions": item.get("note"),
            }
            for item in items
        ],
        "order_total": sum(int(i["price"] * 100) for i in items),
        "tip": random.randint(200, 800),
        "special_instructions": random.choice(
            [
                None,
                "Please make sure ranch is on the side",
                "No onions on anything — severe allergy",
                "Extra napkins please",
                "Light salt",
                "Well done please",
            ]
        ),
    }


async def push_order_to_webhook(
    base_url: str, menu_pool: list[dict[str, Any]]
) -> dict[str, Any]:
    """Generate a fake order and POST it to our own webhook (signed)."""
    import json

    payload = _mk_order(menu_pool)
    body = json.dumps(payload).encode()
    signature = sign_payload(body, settings.doordash_webhook_secret)
    timestamp = str(int(datetime.now(UTC).timestamp()))
    headers = {
        "Content-Type": "application/json",
        "X-DoorDash-Signature": signature,
        "X-DoorDash-Timestamp": timestamp,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{base_url}/webhooks/doordash", content=body, headers=headers)
        resp.raise_for_status()
    return payload


async def update_item_availability(item_id: int, available: bool) -> dict[str, Any]:
    """Mock receiving an 86'd-item update from us — always returns 200."""
    return {
        "platform": PLATFORM,
        "item_id": item_id,
        "available": available,
        "updated_at": datetime.now(UTC).isoformat(),
        "status": "ok",
    }


def normalize(payload: dict[str, Any]) -> dict[str, Any]:
    """Convert DoorDash schema → unified IncomingOrder schema."""
    cust = payload.get("customer", {})
    return {
        "platform": PLATFORM,
        "external_order_id": payload["order_id"],
        "customer_name": f"{cust.get('first_name', '')} {cust.get('last_name', '')}".strip(),
        "placed_at": payload["created_at"],
        "pickup_time": payload.get("pickup_time"),
        "items": [
            {
                "raw_name": it["name"],
                "quantity": it["quantity"],
                "raw_modifiers": [m["name"] for m in it.get("modifiers", [])],
                "raw_special_instructions": it.get("special_instructions"),
                "unit_price": it.get("price", 0) / 100,
            }
            for it in payload.get("items", [])
        ],
        "raw_special_instructions": payload.get("special_instructions"),
        "raw_payload": payload,
    }
