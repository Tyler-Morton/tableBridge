"""Reports & analytics endpoints (and CSV export)."""

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_any
from app.models.auth import User
from app.models.orders import IncomingOrderRaw, OrderReview, ParsedOrder, SyncLog
from app.services.encryption import decrypt_json

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary")
async def summary(
    days: int = Query(default=7, ge=1, le=90),
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Top-level metrics for the dashboard."""
    since = datetime.now(UTC) - timedelta(days=days)

    rows = (
        await db.execute(
            select(IncomingOrderRaw.platform, func.count(IncomingOrderRaw.id))
            .where(IncomingOrderRaw.received_at >= since)
            .group_by(IncomingOrderRaw.platform)
        )
    ).all()
    by_platform = {p: c for p, c in rows}

    confidence_rows = (
        await db.execute(
            select(
                func.avg(ParsedOrder.overall_confidence),
                func.count(ParsedOrder.id),
                func.sum(
                    func.coalesce(
                        func.cast(ParsedOrder.flagged, type_=__import__("sqlalchemy").Integer), 0
                    )
                ),
            ).where(ParsedOrder.created_at >= since)
        )
    ).one()
    avg_confidence = float(confidence_rows[0] or 0)
    total_parsed = int(confidence_rows[1] or 0)
    total_flagged = int(confidence_rows[2] or 0)

    review_rows = (
        await db.execute(
            select(OrderReview.action, func.count(OrderReview.id))
            .where(OrderReview.created_at >= since)
            .group_by(OrderReview.action)
        )
    ).all()
    by_action = {a: c for a, c in review_rows}

    edited_count = (
        await db.execute(
            select(func.count(OrderReview.id))
            .where(OrderReview.created_at >= since)
            .where(OrderReview.edits_json != {})
        )
    ).scalar_one()

    sync_rows = (
        await db.execute(
            select(SyncLog.status, func.count(SyncLog.id))
            .where(SyncLog.timestamp >= since)
            .group_by(SyncLog.status)
        )
    ).all()
    sync_by_status = {s: c for s, c in sync_rows}

    return {
        "window_days": days,
        "orders_per_platform": by_platform,
        "total_orders": sum(by_platform.values()),
        "avg_ai_confidence": round(avg_confidence, 3),
        "flagged_orders": total_flagged,
        "flagged_pct": round(total_flagged / total_parsed * 100, 1) if total_parsed else 0.0,
        "review_actions": by_action,
        "edited_orders": int(edited_count or 0),
        "edit_rate_pct": (
            round((edited_count or 0) / total_parsed * 100, 1) if total_parsed else 0.0
        ),
        "sync_results": sync_by_status,
        "sync_failure_pct": (
            round(sync_by_status.get("failure", 0) / sum(sync_by_status.values()) * 100, 1)
            if sync_by_status
            else 0.0
        ),
    }


@router.get("/allergies")
async def allergy_frequency(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """How often each allergy is flagged."""
    since = datetime.now(UTC) - timedelta(days=days)
    rows = (
        await db.execute(select(ParsedOrder).where(ParsedOrder.created_at >= since))
    ).scalars().all()
    counts: dict[str, int] = {}
    for p in rows:
        for a in p.parsed_json.get("detected_allergies", []):
            counts[a] = counts.get(a, 0) + 1
    return counts


@router.get("/orders.csv")
async def orders_csv(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Export the order log as CSV (no full PII — uses display name)."""
    since = datetime.now(UTC) - timedelta(days=days)
    rows = (
        await db.execute(
            select(IncomingOrderRaw, ParsedOrder, OrderReview)
            .join(ParsedOrder, ParsedOrder.raw_id == IncomingOrderRaw.id)
            .outerjoin(OrderReview, OrderReview.parsed_id == ParsedOrder.id)
            .where(IncomingOrderRaw.received_at >= since)
            .order_by(IncomingOrderRaw.received_at.desc())
        )
    ).all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(
        [
            "raw_id", "platform", "external_order_id", "received_at",
            "confidence", "flagged", "items", "allergies", "action",
            "toast_order_id", "edited",
        ]
    )
    for raw, parsed, review in rows:
        payload = decrypt_json(raw.payload_encrypted)
        cust = payload.get("customer") or payload.get("eater") or payload.get("diner") or {}
        first = (cust.get("first_name") or "").strip()
        last_initial = (cust.get("last_name") or "")[:1]
        _display = f"{first} {last_initial}.".strip() if first else ""  # noqa: F841 (reserved for future use)
        writer.writerow(
            [
                raw.id,
                raw.platform,
                raw.external_order_id,
                raw.received_at.isoformat() if raw.received_at else "",
                parsed.overall_confidence,
                parsed.flagged,
                len(parsed.parsed_json.get("mapped_items", [])),
                ";".join(parsed.parsed_json.get("detected_allergies", [])),
                review.action if review else "pending_review",
                review.toast_order_id if review else "",
                "yes" if review and review.edits_json else "no",
            ]
        )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=orders_{days}d.csv"},
    )
