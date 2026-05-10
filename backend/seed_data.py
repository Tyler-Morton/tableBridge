"""Idempotent seed script — restaurant, users, menu.

Runs automatically on startup if the database is empty.
Also runnable directly: `python seed_data.py`.
"""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.database import AsyncSessionLocal, create_tables
from app.models.auth import User, UserRole
from app.models.menu import (
    MenuCategory,
    MenuItem,
    Modifier,
    ModifierGroup,
    Restaurant,
)
from app.security import hash_password, hash_pin

logger = logging.getLogger(__name__)


SEED_USERS = [
    {
        "email": "owner@tablebridge.demo",
        "name": "Olivia Owner",
        "password": "OwnerPass!2024",
        "pin": "1234",
        "role": UserRole.owner,
    },
    {
        "email": "manager@tablebridge.demo",
        "name": "Marco Manager",
        "password": "ManagerPass!2024",
        "pin": "5678",
        "role": UserRole.manager,
    },
    {
        "email": "server@tablebridge.demo",
        "name": "Sasha Server",
        "password": "ServerPass!2024",
        "pin": "9999",
        "role": UserRole.server,
    },
]


SEED_MENU: list[dict] = [
    {
        "name": "Starters",
        "items": [
            {
                "name": "Crispy Calamari",
                "description": "Fried calamari with marinara",
                "price": 12.0,
                "allergens": ["gluten", "shellfish", "wheat"],
                "modifier_groups": [
                    {
                        "name": "Sauce",
                        "min": 0,
                        "max": 2,
                        "modifiers": [
                            {"name": "Marinara", "price": 0},
                            {"name": "Spicy Aioli", "price": 0.5},
                            {"name": "Lemon Butter", "price": 0.5},
                        ],
                    }
                ],
            },
            {
                "name": "Caesar Salad",
                "description": "Romaine, parmesan, croutons, anchovy dressing",
                "price": 11.0,
                "allergens": ["dairy", "eggs", "gluten", "wheat", "fish"],
                "modifier_groups": [
                    {
                        "name": "Add Protein",
                        "min": 0,
                        "max": 1,
                        "modifiers": [
                            {"name": "Grilled Chicken", "price": 5},
                            {"name": "Shrimp", "price": 7},
                            {"name": "Salmon", "price": 8},
                        ],
                    },
                    {
                        "name": "Dressing",
                        "min": 0,
                        "max": 1,
                        "modifiers": [
                            {"name": "On the side", "price": 0},
                            {"name": "Light", "price": 0},
                            {"name": "Extra", "price": 0},
                        ],
                    },
                ],
            },
            {
                "name": "Bruschetta",
                "description": "Toasted bread, tomato, basil, garlic",
                "price": 9.0,
                "allergens": ["gluten", "wheat"],
                "modifier_groups": [],
            },
        ],
    },
    {
        "name": "Burgers",
        "items": [
            {
                "name": "Classic Cheeseburger",
                "description": "Beef patty, cheddar, lettuce, tomato, onion",
                "price": 14.0,
                "allergens": ["dairy", "gluten", "wheat"],
                "modifier_groups": [
                    {
                        "name": "Doneness",
                        "min": 1,
                        "max": 1,
                        "required": True,
                        "modifiers": [
                            {"name": "Rare", "price": 0},
                            {"name": "Medium Rare", "price": 0},
                            {"name": "Medium", "price": 0},
                            {"name": "Medium Well", "price": 0},
                            {"name": "Well Done", "price": 0},
                        ],
                    },
                    {
                        "name": "Add-ons",
                        "min": 0,
                        "max": 4,
                        "modifiers": [
                            {"name": "Bacon", "price": 2},
                            {"name": "Avocado", "price": 1.5},
                            {"name": "Fried Egg", "price": 1.5},
                            {"name": "Extra Cheese", "price": 1},
                        ],
                    },
                    {
                        "name": "Hold",
                        "min": 0,
                        "max": 4,
                        "modifiers": [
                            {"name": "No Onion", "price": 0},
                            {"name": "No Tomato", "price": 0},
                            {"name": "No Lettuce", "price": 0},
                            {"name": "No Pickle", "price": 0},
                        ],
                    },
                ],
            },
            {
                "name": "Veggie Burger",
                "description": "House-made black bean patty, lettuce, tomato, special sauce",
                "price": 13.0,
                "allergens": ["gluten", "wheat", "soy"],
                "modifier_groups": [
                    {
                        "name": "Bun",
                        "min": 1,
                        "max": 1,
                        "required": True,
                        "modifiers": [
                            {"name": "Brioche", "price": 0},
                            {"name": "Gluten-Free", "price": 1.5},
                            {"name": "Lettuce Wrap", "price": 0},
                        ],
                    }
                ],
            },
        ],
    },
    {
        "name": "Pizzas",
        "items": [
            {
                "name": "Margherita Pizza",
                "description": "Fresh mozzarella, basil, tomato, olive oil",
                "price": 16.0,
                "allergens": ["dairy", "gluten", "wheat"],
                "modifier_groups": [
                    {
                        "name": "Size",
                        "min": 1,
                        "max": 1,
                        "required": True,
                        "modifiers": [
                            {"name": "10\"", "price": 0},
                            {"name": "14\"", "price": 4},
                            {"name": "18\"", "price": 8},
                        ],
                    },
                    {
                        "name": "Toppings",
                        "min": 0,
                        "max": 5,
                        "modifiers": [
                            {"name": "Pepperoni", "price": 2},
                            {"name": "Mushrooms", "price": 1.5},
                            {"name": "Olives", "price": 1.5},
                            {"name": "Sausage", "price": 2},
                        ],
                    },
                ],
            },
            {
                "name": "Pepperoni Pizza",
                "description": "Mozzarella, pepperoni, tomato",
                "price": 18.0,
                "allergens": ["dairy", "gluten", "wheat"],
                "modifier_groups": [],
            },
        ],
    },
    {
        "name": "Mains",
        "items": [
            {
                "name": "Grilled Salmon",
                "description": "Atlantic salmon, lemon butter, seasonal veg",
                "price": 24.0,
                "allergens": ["fish", "dairy"],
                "modifier_groups": [
                    {
                        "name": "Side",
                        "min": 1,
                        "max": 1,
                        "required": True,
                        "modifiers": [
                            {"name": "Fries", "price": 0},
                            {"name": "Side Salad", "price": 0},
                            {"name": "Mashed Potatoes", "price": 0},
                            {"name": "Rice Pilaf", "price": 0},
                        ],
                    }
                ],
            },
            {
                "name": "Pan-Seared Chicken",
                "description": "Free-range chicken, mushroom jus",
                "price": 19.0,
                "allergens": ["dairy"],
                "modifier_groups": [],
            },
        ],
    },
    {
        "name": "Desserts",
        "items": [
            {
                "name": "Chocolate Lava Cake",
                "description": "Warm chocolate cake, vanilla ice cream",
                "price": 9.0,
                "allergens": ["dairy", "eggs", "gluten", "wheat"],
                "modifier_groups": [],
            },
            {
                "name": "Tiramisu",
                "description": "Classic Italian dessert",
                "price": 8.5,
                "allergens": ["dairy", "eggs", "gluten", "wheat"],
                "modifier_groups": [],
            },
        ],
    },
]


async def maybe_seed() -> None:
    """Seed only if there are zero restaurants in the DB."""
    async with AsyncSessionLocal() as db:
        existing = (await db.execute(select(Restaurant))).scalar_one_or_none()
        if existing:
            logger.info("Seed skipped — restaurant already exists")
            return

        rest = Restaurant(
            name="The Bridge Bistro",
            timezone="America/New_York",
            settings_json={
                "demo_mode": True,
                "ai_confidence_threshold": 0.85,
                "alert_volume": 0.7,
                "platform_enabled": {"doordash": True, "ubereats": True, "grubhub": True},
            },
        )
        db.add(rest)
        await db.flush()

        for u in SEED_USERS:
            db.add(
                User(
                    email=u["email"],
                    name=u["name"],
                    password_hash=hash_password(u["password"]),
                    pin_hash=hash_pin(u["pin"]),
                    role=u["role"],
                    active=True,
                )
            )

        for order_idx, cat in enumerate(SEED_MENU):
            mc = MenuCategory(
                restaurant_id=rest.id, name=cat["name"], display_order=order_idx
            )
            db.add(mc)
            await db.flush()
            for item in cat["items"]:
                mi = MenuItem(
                    category_id=mc.id,
                    name=item["name"],
                    description=item["description"],
                    price=item["price"],
                    prep_time=item.get("prep_time", 12),
                    allergen_tags=item["allergens"],
                    available=True,
                )
                db.add(mi)
                await db.flush()
                for grp in item.get("modifier_groups", []):
                    mg = ModifierGroup(
                        item_id=mi.id,
                        name=grp["name"],
                        required=grp.get("required", False),
                        min_select=grp.get("min", 0),
                        max_select=grp.get("max", 1),
                    )
                    db.add(mg)
                    await db.flush()
                    for m in grp["modifiers"]:
                        db.add(
                            Modifier(
                                group_id=mg.id,
                                name=m["name"],
                                price_adjustment=m.get("price", 0),
                                available=True,
                            )
                        )
        await db.commit()
        logger.info("Seed complete: 1 restaurant, %d users, %d categories", len(SEED_USERS), len(SEED_MENU))


async def _main() -> None:
    await create_tables()
    await maybe_seed()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(_main())
