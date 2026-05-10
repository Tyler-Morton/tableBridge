"""AI parser — heuristic fallback path (no Anthropic API key needed)."""

from datetime import UTC, datetime

import pytest

from app.schemas.orders import IncomingOrder
from app.services import ai_parser


@pytest.mark.asyncio
async def test_heuristic_basic_match():
    incoming = IncomingOrder.model_validate(
        {
            "platform": "doordash",
            "external_order_id": "DD-TEST-1",
            "customer_name": "Test C",
            "placed_at": datetime.now(UTC),
            "items": [
                {"raw_name": "Classic Cheeseburger", "quantity": 1, "raw_modifiers": []},
            ],
            "raw_special_instructions": None,
            "raw_payload": {},
        }
    )
    menu = [
        {
            "id": 1,
            "name": "Burgers",
            "items": [
                {
                    "id": 100,
                    "name": "Classic Cheeseburger",
                    "available": True,
                    "allergen_tags": ["dairy", "gluten"],
                    "price": 14.0,
                    "modifier_groups": [],
                }
            ],
        }
    ]
    parsed, _, _ = await ai_parser.parse_order(incoming, menu)
    assert parsed.mapped_items
    assert parsed.mapped_items[0].menu_item_id == 100


@pytest.mark.asyncio
async def test_allergy_detection():
    incoming = IncomingOrder.model_validate(
        {
            "platform": "ubereats",
            "external_order_id": "UE-TEST-2",
            "customer_name": "Allergy A",
            "placed_at": datetime.now(UTC),
            "items": [
                {"raw_name": "Caesar Salad", "quantity": 1, "raw_modifiers": []},
            ],
            "raw_special_instructions": "I'm allergic to peanuts — please be careful",
            "raw_payload": {},
        }
    )
    menu = [{"id": 1, "name": "Salads", "items": [
        {"id": 200, "name": "Caesar Salad", "available": True, "allergen_tags": [], "price": 11.0, "modifier_groups": []},
    ]}]
    parsed, _, _ = await ai_parser.parse_order(incoming, menu)
    assert "peanuts" in parsed.detected_allergies
    assert parsed.flagged_for_review


def test_pii_stripper_removes_customer_name():
    """Verify PII never leaves _strip_pii."""
    incoming = IncomingOrder.model_validate(
        {
            "platform": "doordash",
            "external_order_id": "X",
            "customer_name": "Sensitive Person",
            "placed_at": datetime.now(UTC),
            "items": [{"raw_name": "Burger", "quantity": 1, "raw_modifiers": []}],
            "raw_special_instructions": None,
            "raw_payload": {"customer": {"phone": "555-555-5555"}},
        }
    )
    sanitized = ai_parser._strip_pii(incoming)
    flat = repr(sanitized)
    assert "Sensitive" not in flat
    assert "555" not in flat
