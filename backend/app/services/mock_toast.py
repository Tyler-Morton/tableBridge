"""Mock Toast POS — accepts confirmed orders, exposes menu, tracks 86'd state."""

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.menu import MenuCategory, MenuItem, ModifierGroup
from app.models.orders import ToastOrder


async def get_menu(db: AsyncSession) -> list[dict[str, Any]]:
    """Return the full menu (categories → items → modifier groups → modifiers)."""
    result = await db.execute(
        select(MenuCategory)
        .options(
            selectinload(MenuCategory.items)
            .selectinload(MenuItem.modifier_groups)
            .selectinload(ModifierGroup.modifiers)
        )
        .order_by(MenuCategory.display_order)
    )
    cats = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "display_order": c.display_order,
            "items": [
                {
                    "id": it.id,
                    "name": it.name,
                    "description": it.description,
                    "price": it.price,
                    "prep_time": it.prep_time,
                    "allergen_tags": it.allergen_tags or [],
                    "available": it.available,
                    "modifier_groups": [
                        {
                            "id": g.id,
                            "name": g.name,
                            "required": g.required,
                            "min_select": g.min_select,
                            "max_select": g.max_select,
                            "modifiers": [
                                {
                                    "id": m.id,
                                    "name": m.name,
                                    "price_adjustment": m.price_adjustment,
                                    "available": m.available,
                                }
                                for m in g.modifiers
                            ],
                        }
                        for g in it.modifier_groups
                    ],
                }
                for it in c.items
            ],
        }
        for c in cats
    ]


async def fire_order(db: AsyncSession, payload: dict[str, Any]) -> dict[str, Any]:
    """Accept a confirmed order and create a kitchen ticket."""
    toast_order_id = f"TST-{uuid.uuid4().hex[:10].upper()}"
    order = ToastOrder(
        toast_order_id=toast_order_id,
        payload=payload,
        status="fired",
        fired_at=datetime.now(UTC),
    )
    db.add(order)
    await db.flush()
    return {
        "toast_order_id": toast_order_id,
        "status": "fired",
        "fired_at": order.fired_at.isoformat(),
        "kitchen_ticket": payload,
    }


async def set_item_availability(db: AsyncSession, item_id: int, available: bool) -> MenuItem:
    """PATCH equivalent — toggle 86'd state on a Toast menu item."""
    result = await db.execute(select(MenuItem).where(MenuItem.id == item_id))
    item = result.scalar_one()
    item.available = available
    return item


async def list_kitchen_tickets(db: AsyncSession, limit: int = 50) -> list[dict[str, Any]]:
    """Tickets that have been fired and are waiting / in progress."""
    result = await db.execute(
        select(ToastOrder).order_by(ToastOrder.fired_at.desc()).limit(limit)
    )
    tickets = result.scalars().all()
    return [
        {
            "toast_order_id": t.toast_order_id,
            "status": t.status,
            "fired_at": t.fired_at.isoformat() if t.fired_at else None,
            "payload": t.payload,
        }
        for t in tickets
    ]
