"""Webhook intake — DoorDash / Uber Eats / Grubhub.

Verifies HMAC signatures, rejects replays older than 5 min, deduplicates by
external_order_id, then runs the order through the AI parser and broadcasts
the result via WebSocket.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import AsyncSessionLocal, get_db
from app.models.orders import IncomingOrderRaw, ParsedOrder
from app.ratelimit import limiter
from app.schemas.orders import IncomingOrder
from app.security import verify_hmac_signature
from app.services import ai_parser, mock_doordash, mock_grubhub, mock_toast, mock_ubereats
from app.services.encryption import encrypt_json
from app.websockets import manager

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

REPLAY_WINDOW_SECONDS = 300  # 5 min


def _check_timestamp(ts_header: str | None) -> None:
    if not ts_header:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Missing timestamp header")
    try:
        ts = int(ts_header)
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid timestamp") from e
    now = int(datetime.now(UTC).timestamp())
    if abs(now - ts) > REPLAY_WINDOW_SECONDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Timestamp outside replay window")


async def _process_webhook(
    db: AsyncSession,
    *,
    body: bytes,
    signature: str | None,
    timestamp: str | None,
    secret: str,
    platform: str,
    normalize_fn,
) -> dict[str, Any]:
    _check_timestamp(timestamp)
    sig_valid = verify_hmac_signature(body, signature or "", secret)
    if not sig_valid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid HMAC signature")

    payload = json.loads(body)
    normalized = normalize_fn(payload)
    incoming = IncomingOrder.model_validate(normalized)

    # Idempotency — same external_order_id is silently ignored
    dup = await db.execute(
        select(IncomingOrderRaw).where(
            IncomingOrderRaw.platform == platform,
            IncomingOrderRaw.external_order_id == incoming.external_order_id,
        )
    )
    if dup.scalar_one_or_none():
        logger.info("Duplicate webhook for %s/%s — ignored", platform, incoming.external_order_id)
        return {"status": "duplicate", "external_order_id": incoming.external_order_id}

    raw_record = IncomingOrderRaw(
        platform=platform,
        external_order_id=incoming.external_order_id,
        payload_encrypted=encrypt_json(payload),
        signature_valid=True,
    )
    db.add(raw_record)
    await db.flush()

    # Kick off AI parsing in the background — don't block the webhook ACK
    asyncio.create_task(_parse_and_broadcast(raw_record.id, incoming))

    return {"status": "accepted", "raw_id": raw_record.id}


async def _parse_and_broadcast(raw_id: int, incoming: IncomingOrder) -> None:
    """Background task — parse + persist + broadcast 'new_order' event."""
    async with AsyncSessionLocal() as db:
        try:
            menu = await mock_toast.get_menu(db)
            parsed, tokens, duration_ms = await ai_parser.parse_order(incoming, menu)

            parsed_record = ParsedOrder(
                raw_id=raw_id,
                parsed_json=parsed.model_dump(mode="json"),
                overall_confidence=parsed.overall_confidence,
                flagged=parsed.flagged_for_review,
                ai_tokens_used=tokens,
                parse_duration_ms=duration_ms,
            )
            db.add(parsed_record)

            raw = (
                await db.execute(select(IncomingOrderRaw).where(IncomingOrderRaw.id == raw_id))
            ).scalar_one()
            raw.processed_at = datetime.now(UTC)

            await db.commit()
            await db.refresh(parsed_record)

            # Use only first name + last initial for display (no full PII to clients)
            parts = incoming.customer_name.split()
            display_name = (
                f"{parts[0]} {parts[-1][0]}." if len(parts) >= 2 else incoming.customer_name
            )

            await manager.broadcast(
                "new_order",
                {
                    "raw_id": raw_id,
                    "parsed_id": parsed_record.id,
                    "platform": incoming.platform,
                    "customer_display_name": display_name,
                    "overall_confidence": parsed.overall_confidence,
                    "flagged": parsed.flagged_for_review,
                    "has_allergies": bool(parsed.detected_allergies),
                    "item_count": len(parsed.mapped_items),
                    "placed_at": incoming.placed_at.isoformat(),
                },
            )
        except Exception:  # noqa: BLE001
            logger.exception("Failed to parse/broadcast raw_id=%s", raw_id)


@router.post("/doordash")
@limiter.limit(settings.webhook_rate_limit)
async def doordash_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_doordash_signature: str | None = Header(default=None),
    x_doordash_timestamp: str | None = Header(default=None),
) -> dict[str, Any]:
    body = await request.body()
    return await _process_webhook(
        db,
        body=body,
        signature=x_doordash_signature,
        timestamp=x_doordash_timestamp,
        secret=settings.doordash_webhook_secret,
        platform="doordash",
        normalize_fn=mock_doordash.normalize,
    )


@router.post("/ubereats")
@limiter.limit(settings.webhook_rate_limit)
async def ubereats_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_uber_signature: str | None = Header(default=None),
    x_uber_timestamp: str | None = Header(default=None),
) -> dict[str, Any]:
    body = await request.body()
    return await _process_webhook(
        db,
        body=body,
        signature=x_uber_signature,
        timestamp=x_uber_timestamp,
        secret=settings.ubereats_webhook_secret,
        platform="ubereats",
        normalize_fn=mock_ubereats.normalize,
    )


@router.post("/grubhub")
@limiter.limit(settings.webhook_rate_limit)
async def grubhub_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_grubhub_signature: str | None = Header(default=None),
    x_grubhub_timestamp: str | None = Header(default=None),
) -> dict[str, Any]:
    body = await request.body()
    return await _process_webhook(
        db,
        body=body,
        signature=x_grubhub_signature,
        timestamp=x_grubhub_timestamp,
        secret=settings.grubhub_webhook_secret,
        platform="grubhub",
        normalize_fn=mock_grubhub.normalize,
    )
