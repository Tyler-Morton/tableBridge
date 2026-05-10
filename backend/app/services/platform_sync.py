"""Two-way 86'd-item sync engine.

Detects availability changes in the mock Toast menu and pushes them to all three
mock delivery platforms. Has retry-with-backoff and a periodic reconciliation pass.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.menu import MenuItem
from app.models.orders import SyncLog
from app.services import mock_doordash, mock_grubhub, mock_ubereats
from app.websockets import manager

logger = logging.getLogger(__name__)

PLATFORM_MODULES = {
    "doordash": mock_doordash,
    "ubereats": mock_ubereats,
    "grubhub": mock_grubhub,
}

RETRY_DELAYS = (5, 30, 120)  # seconds — 5s, 30s, 2min


# Per-process snapshot of last-known availability — change detection
_last_known: dict[int, bool] = {}


async def _push_with_retry(
    db: AsyncSession,
    platform: str,
    item_id: int,
    available: bool,
) -> bool:
    """Push availability change to one platform with exponential backoff."""
    module = PLATFORM_MODULES[platform]
    last_error: str | None = None
    for attempt, delay in enumerate([0, *RETRY_DELAYS], start=1):
        if delay:
            await asyncio.sleep(delay)
        try:
            result = await module.update_item_availability(item_id, available)
            db.add(
                SyncLog(
                    item_id=item_id,
                    platform=platform,
                    action="86" if not available else "restore",
                    status="success",
                    attempt_count=attempt,
                )
            )
            logger.info("Synced %s to %s (attempt %d): %s", item_id, platform, attempt, result)
            return True
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            logger.warning("Sync attempt %d to %s failed: %s", attempt, platform, exc)

    db.add(
        SyncLog(
            item_id=item_id,
            platform=platform,
            action="86" if not available else "restore",
            status="failure",
            attempt_count=len(RETRY_DELAYS) + 1,
            error_message=last_error,
        )
    )
    await manager.broadcast(
        "sync_alert",
        {
            "item_id": item_id,
            "platform": platform,
            "available": available,
            "error": last_error,
            "timestamp": datetime.now(UTC).isoformat(),
        },
    )
    return False


async def poll_and_sync() -> None:
    """Detect Toast menu changes; push to all platforms in parallel."""
    async with AsyncSessionLocal() as db:
        items = (await db.execute(select(MenuItem))).scalars().all()
        changes: list[MenuItem] = []
        for it in items:
            prev = _last_known.get(it.id)
            if prev is None:
                _last_known[it.id] = it.available
                continue
            if prev != it.available:
                _last_known[it.id] = it.available
                changes.append(it)

        if not changes:
            return

        logger.info("Detected %d availability change(s)", len(changes))
        tasks: list[asyncio.Task[bool]] = []
        for it in changes:
            for platform in PLATFORM_MODULES:
                tasks.append(
                    asyncio.create_task(_push_with_retry(db, platform, it.id, it.available))
                )
        await asyncio.gather(*tasks, return_exceptions=True)
        await db.commit()


async def reconcile() -> None:
    """Every 15 min — compare local Toast state vs mock platform state.

    With pure mocks the platforms always agree, but the structure is in place
    for real APIs.
    """
    async with AsyncSessionLocal() as db:
        items = (await db.execute(select(MenuItem))).scalars().all()
        drift_count = 0
        for it in items:
            for platform in PLATFORM_MODULES:
                # Real impl would GET item availability from each platform here.
                expected = it.available
                actual = expected  # mocks are always consistent
                if expected != actual:
                    drift_count += 1
                    db.add(
                        SyncLog(
                            item_id=it.id,
                            platform=platform,
                            action="reconcile",
                            status="drift",
                            attempt_count=1,
                            error_message=f"expected={expected} actual={actual}",
                        )
                    )
        await db.commit()
        if drift_count:
            await manager.broadcast(
                "reconciliation_drift",
                {"drift_count": drift_count, "timestamp": datetime.now(UTC).isoformat()},
            )
        logger.info("Reconciliation: %d drift entries", drift_count)
