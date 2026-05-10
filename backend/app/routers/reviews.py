"""Order review actions — Send to Kitchen / Flag for Manager / Reject."""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_any
from app.models.auth import User
from app.models.orders import IncomingOrderRaw, OrderReview, ParsedOrder
from app.schemas.orders import ReviewRequest
from app.services import audit, mock_toast
from app.services.encryption import decrypt_json
from app.websockets import manager

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def submit_review(
    payload: ReviewRequest,
    request: Request,
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Server taps an action on the review screen → record + (maybe) fire to Toast."""
    parsed = (
        await db.execute(select(ParsedOrder).where(ParsedOrder.id == payload.parsed_id))
    ).scalar_one_or_none()
    if not parsed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parsed order not found")

    existing = (
        await db.execute(select(OrderReview).where(OrderReview.parsed_id == payload.parsed_id))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "Order has already been reviewed")

    raw = (
        await db.execute(select(IncomingOrderRaw).where(IncomingOrderRaw.id == parsed.raw_id))
    ).scalar_one()

    edits_dict = payload.edits.model_dump() if payload.edits else {}
    review = OrderReview(
        parsed_id=parsed.id,
        reviewed_by=user.id,
        action=payload.action,
        edits_json=edits_dict,
        notes=payload.notes,
    )

    toast_order_id: str | None = None
    if payload.action == "send":
        # Fire to mock Toast — use edited version if present
        final = edits_dict or parsed.parsed_json
        raw_payload = decrypt_json(raw.payload_encrypted)
        kitchen_payload = {
            "platform": raw.platform,
            "external_order_id": raw.external_order_id,
            "customer_first_name": (
                raw_payload.get("customer", {}).get("first_name")
                or raw_payload.get("eater", {}).get("first_name")
                or raw_payload.get("diner", {}).get("first_name")
            ),
            "items": final.get("mapped_items", []),
            "allergies": final.get("detected_allergies", []),
            "dietary": final.get("detected_dietary", []),
            "kitchen_note": final.get("kitchen_note"),
            "fired_by": user.name,
        }
        result = await mock_toast.fire_order(db, kitchen_payload)
        toast_order_id = result["toast_order_id"]
        review.sent_to_toast_at = datetime.now(UTC)
        review.toast_order_id = toast_order_id

    db.add(review)

    await audit.record(
        db,
        user_id=user.id,
        action=f"review_{payload.action}",
        entity_type="parsed_order",
        entity_id=str(parsed.id),
        before={"parsed": parsed.parsed_json},
        after={"action": payload.action, "edits": edits_dict, "toast_order_id": toast_order_id},
        ip_address=request.client.host if request.client else None,
    )

    await db.commit()

    await manager.broadcast(
        "order_reviewed",
        {
            "parsed_id": parsed.id,
            "action": payload.action,
            "toast_order_id": toast_order_id,
            "by": user.name,
        },
    )
    if toast_order_id:
        await manager.broadcast(
            "kitchen_ticket",
            {"toast_order_id": toast_order_id, "fired_at": datetime.now(UTC).isoformat()},
        )

    return {
        "review_id": review.id,
        "action": payload.action,
        "toast_order_id": toast_order_id,
    }
