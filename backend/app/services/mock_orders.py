"""Demo mode — periodic mock-order generator covering all scenarios."""

from __future__ import annotations

import logging
import random
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.menu import MenuItem
from app.services import mock_doordash, mock_grubhub, mock_ubereats

logger = logging.getLogger(__name__)
settings = get_settings()


SCENARIO_NOTES = [
    None,                                                # simple order
    "Extra cheese please, light salt",                   # complex modifiers
    "Severe peanut allergy — DO NOT contain peanuts",    # allergy
    "no onions, no tomato",                              # "no X"
    "On the side: ranch, blue cheese, ketchup",          # ambiguous
    "Vegan please — no dairy or eggs",                   # dietary
    "Double everything, well done, extra crispy",        # large + complex
]

PLATFORMS = [
    ("doordash", mock_doordash),
    ("ubereats", mock_ubereats),
    ("grubhub", mock_grubhub),
]


async def _menu_pool(db: AsyncSession) -> list[dict[str, Any]]:
    """Snapshot of available menu items for the mock generators."""
    items = (await db.execute(select(MenuItem).where(MenuItem.available == True))).scalars().all()  # noqa: E712
    return [
        {
            "id": i.id,
            "name": i.name,
            "price": i.price,
            "modifiers": _random_modifier_names(),
            "note": random.choice(SCENARIO_NOTES),
        }
        for i in items
    ]


def _random_modifier_names() -> list[str]:
    pool = [
        "Extra cheese", "No onions", "Light salt", "Well done",
        "On the side: ranch", "Add bacon", "Sub side salad",
        "No tomato", "Extra hot", "Cut in half",
    ]
    return random.sample(pool, k=random.randint(0, 3))


async def generate_one(base_url: str = "http://localhost:8000") -> dict[str, Any]:
    """Generate a single order on a random platform and POST to our own webhook."""
    async with AsyncSessionLocal() as db:
        pool = await _menu_pool(db)

    if not pool:
        logger.warning("Menu pool empty — skipping mock order generation")
        return {"skipped": True}

    name, module = random.choice(PLATFORMS)
    payload = await module.push_order_to_webhook(base_url, pool)
    logger.info("Generated mock %s order", name)
    return {"platform": name, "payload": payload}
