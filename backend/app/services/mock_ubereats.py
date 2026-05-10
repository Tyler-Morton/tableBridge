"""Mock Uber Eats platform — generates realistic webhook payloads."""

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.security import sign_payload

settings = get_settings()

PLATFORM = "ubereats"

SAMPLE_FIRST = ["Sam", "Riley", "Casey", "Jordan", "Drew"]
SAMPLE_LAST = ["Garcia", "Chen", "Patel", "Smith", "Brown"]


def _mk_order(menu_pool: list[dict[str, Any]]) -> dict[str, Any]:
    items = random.sample(menu_pool, k=min(len(menu_pool), random.randint(1, 4)))
    return {
        "id": f"UE-{uuid.uuid4().hex[:12]}",
        "display_id": f"UE{random.randint(1000, 9999)}",
        "current_state": "CREATED",
        "placed_at": datetime.now(UTC).isoformat(),
        "estimated_ready_for_pickup_at": (
            datetime.now(UTC) + timedelta(minutes=random.randint(15, 45))
        ).isoformat(),
        "eater": {
            "first_name": random.choice(SAMPLE_FIRST),
            "last_name": random.choice(SAMPLE_LAST),
        },
        "cart": {
            "items": [
                {
                    "id": str(item["id"]),
                    "title": item["name"],
                    "quantity": random.randint(1, 3),
                    "price": {"unit_price": {"amount": int(item["price"] * 100)}},
                    "selected_modifier_groups": [
                        {
                            "title": "Modifications",
                            "selected_items": [
                                {"title": m, "id": f"mod-{uuid.uuid4().hex[:6]}"}
                                for m in item.get("modifiers", [])
                            ],
                        }
                    ]
                    if item.get("modifiers")
                    else [],
                    "special_instructions": item.get("note"),
                }
                for item in items
            ]
        },
        "customer_note": random.choice(
            [
                None,
                "Vegetarian please — no meat on anything",
                "Please add extra cheese",
                "Allergic to peanuts — DO NOT include",
                "On the side: dressing",
            ]
        ),
    }


async def push_order_to_webhook(
    base_url: str, menu_pool: list[dict[str, Any]]
) -> dict[str, Any]:
    payload = _mk_order(menu_pool)
    body = json.dumps(payload).encode()
    signature = sign_payload(body, settings.ubereats_webhook_secret)
    timestamp = str(int(datetime.now(UTC).timestamp()))
    headers = {
        "Content-Type": "application/json",
        "X-Uber-Signature": signature,
        "X-Uber-Timestamp": timestamp,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{base_url}/webhooks/ubereats", content=body, headers=headers)
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
    """Uber Eats → unified IncomingOrder."""
    eater = payload.get("eater", {})
    items = payload.get("cart", {}).get("items", [])
    return {
        "platform": PLATFORM,
        "external_order_id": payload["id"],
        "customer_name": f"{eater.get('first_name', '')} {eater.get('last_name', '')}".strip(),
        "placed_at": payload["placed_at"],
        "pickup_time": payload.get("estimated_ready_for_pickup_at"),
        "items": [
            {
                "raw_name": it["title"],
                "quantity": it["quantity"],
                "raw_modifiers": [
                    sel["title"]
                    for grp in it.get("selected_modifier_groups", [])
                    for sel in grp.get("selected_items", [])
                ],
                "raw_special_instructions": it.get("special_instructions"),
                "unit_price": it.get("price", {}).get("unit_price", {}).get("amount", 0) / 100,
            }
            for it in items
        ],
        "raw_special_instructions": payload.get("customer_note"),
        "raw_payload": payload,
    }
