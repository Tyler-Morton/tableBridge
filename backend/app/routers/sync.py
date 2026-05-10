"""Sync log + manual trigger endpoints."""

from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_any, require_manager
from app.models.auth import User
from app.models.orders import SyncLog
from app.services import platform_sync

router = APIRouter(prefix="/sync", tags=["sync"])


@router.get("/log")
async def sync_log(
    limit: int = Query(default=100, le=500),
    user: User = Depends(require_any),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(select(SyncLog).order_by(SyncLog.timestamp.desc()).limit(limit))
    ).scalars().all()
    return [
        {
            "id": r.id,
            "item_id": r.item_id,
            "platform": r.platform,
            "action": r.action,
            "status": r.status,
            "attempt_count": r.attempt_count,
            "error_message": r.error_message,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


@router.post("/run")
async def trigger_sync(user: User = Depends(require_manager)) -> dict[str, str]:
    """Manually kick the sync poll (for demo)."""
    await platform_sync.poll_and_sync()
    return {"status": "ok"}


@router.post("/reconcile")
async def trigger_reconcile(user: User = Depends(require_manager)) -> dict[str, str]:
    await platform_sync.reconcile()
    return {"status": "ok"}
