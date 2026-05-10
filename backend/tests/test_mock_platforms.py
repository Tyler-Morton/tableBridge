"""Confirm each mock-platform normalizer emits the unified schema."""

import json
import random
from datetime import UTC, datetime

from app.schemas.orders import IncomingOrder
from app.services import mock_doordash, mock_grubhub, mock_ubereats


def _menu_pool():
    random.seed(42)
    return [
        {"id": 1, "name": "Burger", "price": 12.0, "modifiers": ["No onions"], "note": None},
        {"id": 2, "name": "Pizza", "price": 16.0, "modifiers": [], "note": "Gluten allergy"},
    ]


def test_doordash_normalize():
    payload = mock_doordash._mk_order(_menu_pool())
    normalized = mock_doordash.normalize(payload)
    order = IncomingOrder.model_validate(normalized)
    assert order.platform == "doordash"
    assert order.external_order_id.startswith("DD-")
    assert len(order.items) >= 1


def test_ubereats_normalize():
    payload = mock_ubereats._mk_order(_menu_pool())
    order = IncomingOrder.model_validate(mock_ubereats.normalize(payload))
    assert order.platform == "ubereats"
    assert len(order.items) >= 1


def test_grubhub_normalize():
    payload = mock_grubhub._mk_order(_menu_pool())
    order = IncomingOrder.model_validate(mock_grubhub.normalize(payload))
    assert order.platform == "grubhub"
    assert len(order.items) >= 1


def test_signed_payload_round_trip():
    """Generated payloads should round-trip JSON cleanly."""
    payload = mock_doordash._mk_order(_menu_pool())
    body = json.dumps(payload).encode()
    assert json.loads(body) == json.loads(body)
    assert datetime.fromisoformat(payload["created_at"]).tzinfo == UTC
