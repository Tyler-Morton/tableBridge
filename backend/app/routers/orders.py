"""Order list + detail (for the review screen)."""

from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_any
from app.models.auth import User
from app.models.orders import IncomingOrderRaw, OrderReview, ParsedOrder
from app.schemas.orders import OrderDetail, OrderListItem, ParsedOrderOut
from app.services.encryption import decrypt_json

router = APIRouter(prefix="/orders", tags=["orders"])


def _display_name(full_name: str) -> str:
    parts = full_name.split()
    return f"{parts[0]} {parts[-1][0]}." if len(parts) >= 2 else full_name


def _status_for(review: OrderReview | None, flagged: bool) -> str:
    if not review:
        return "pending_review"
    return {"send": "sent", "flag": "flagged", "reject": "rejected"}.get(review.action, review.action)


@router.get("", response_model=list[OrderListItem])
async def list_orders(
    platform: str | None = None,
    status_filter: Literal["pending_review", "sent", "flagged", "rejected"] | None = None,
    flagged_only: bool = False,
    limit: int = Query(default=50, le=200),
    offset: int = 0,
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> list[OrderListItem]:
    """Paginated order list — newest first."""
    stmt = (
        select(IncomingOrderRaw, ParsedOrder, OrderReview)
        .join(ParsedOrder, ParsedOrder.raw_id == IncomingOrderRaw.id)
        .outerjoin(OrderReview, OrderReview.parsed_id == ParsedOrder.id)
        .order_by(IncomingOrderRaw.received_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if platform:
        stmt = stmt.where(IncomingOrderRaw.platform == platform)
    if flagged_only:
        stmt = stmt.where(ParsedOrder.flagged == True)  # noqa: E712

    rows = (await db.execute(stmt)).all()
    out: list[OrderListItem] = []
    for raw, parsed, review in rows:
        st = _status_for(review, parsed.flagged)
        if status_filter and st != status_filter:
            continue
        payload = decrypt_json(raw.payload_encrypted)
        # Customer name comes from raw payload — trim before serving
        cust = payload.get("customer") or payload.get("eater") or payload.get("diner") or {}
        full = f"{cust.get('first_name', '')} {cust.get('last_name', '')}".strip()
        parsed_data = parsed.parsed_json
        out.append(
            OrderListItem(
                id=raw.id,
                platform=raw.platform,
                external_order_id=raw.external_order_id,
                customer_display_name=_display_name(full),
                placed_at=_extract_placed_at(payload),
                overall_confidence=parsed.overall_confidence,
                flagged=parsed.flagged,
                status=st,
                item_count=len(parsed_data.get("mapped_items", [])),
                has_allergies=bool(parsed_data.get("detected_allergies")),
            )
        )
    return out


def _extract_placed_at(payload: dict[str, Any]) -> datetime:
    val = (
        payload.get("created_at")
        or payload.get("placed_at")
        or payload.get("order_placed_time")
    )
    if isinstance(val, str):
        return datetime.fromisoformat(val.replace("Z", "+00:00"))
    return datetime.now()


@router.get("/{raw_id}", response_model=OrderDetail)
async def order_detail(
    raw_id: int,
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> OrderDetail:
    """Full raw + parsed + status for the review screen."""
    raw = (
        await db.execute(select(IncomingOrderRaw).where(IncomingOrderRaw.id == raw_id))
    ).scalar_one_or_none()
    if not raw:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Order not found")
    parsed = (
        await db.execute(select(ParsedOrder).where(ParsedOrder.raw_id == raw_id))
    ).scalar_one_or_none()
    if not parsed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Parsed order not yet ready")
    review = (
        await db.execute(select(OrderReview).where(OrderReview.parsed_id == parsed.id))
    ).scalar_one_or_none()

    payload = decrypt_json(raw.payload_encrypted)
    cust = payload.get("customer") or payload.get("eater") or payload.get("diner") or {}
    full = f"{cust.get('first_name', '')} {cust.get('last_name', '')}".strip()

    return OrderDetail(
        raw=payload,
        parsed=ParsedOrderOut.model_validate(parsed.parsed_json),
        raw_id=raw.id,
        parsed_id=parsed.id,
        platform=raw.platform,
        external_order_id=raw.external_order_id,
        placed_at=_extract_placed_at(payload),
        pickup_time=_extract_pickup(payload),
        customer_display_name=_display_name(full),
        status=_status_for(review, parsed.flagged),
    )


def _extract_pickup(payload: dict[str, Any]) -> datetime | None:
    val = (
        payload.get("pickup_time")
        or payload.get("estimated_ready_for_pickup_at")
        or payload.get("expected_time")
    )
    if isinstance(val, str):
        try:
            return datetime.fromisoformat(val.replace("Z", "+00:00"))
        except ValueError:
            return None
    return None
