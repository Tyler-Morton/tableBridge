"""Mock Toast POS API surface — exposes endpoints under /toast/*.

The real Toast API has the same shape: GET /menu, POST /orders, PATCH /items/{id}.
Swapping in real Toast = changing the base URL and adding OAuth credentials.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_any, require_manager
from app.models.auth import User
from app.services import audit, mock_toast

router = APIRouter(prefix="/toast", tags=["toast (mock POS)"])


class AvailabilityPatch(BaseModel):
    available: bool


@router.get("/menu")
async def get_menu(
    user: User = Depends(require_any), db: AsyncSession = Depends(get_db)
) -> list[dict[str, Any]]:
    return await mock_toast.get_menu(db)


@router.patch("/items/{item_id}")
async def patch_item_availability(
    item_id: int,
    payload: AvailabilityPatch,
    user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Mark an item as 86'd / restored — sync engine picks this up next poll."""
    try:
        item = await mock_toast.set_item_availability(db, item_id, payload.available)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item not found") from e

    await audit.record(
        db,
        user_id=user.id,
        action="item_availability_changed",
        entity_type="menu_item",
        entity_id=str(item_id),
        after={"available": payload.available},
    )
    return {"id": item.id, "name": item.name, "available": item.available}


@router.get("/orders")
async def get_kitchen_tickets(
    user: User = Depends(require_any), db: AsyncSession = Depends(get_db)
) -> list[dict[str, Any]]:
    """Kitchen display — most recent fired tickets."""
    return await mock_toast.list_kitchen_tickets(db)
