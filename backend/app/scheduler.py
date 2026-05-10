"""APScheduler bootstrap — demo-order generator + 86'd sync polling.

The demo-order job checks the DB on every tick, so the Settings page toggle
can pause/resume generation in real time (no restart required, no credits
burned while paused).
"""

from __future__ import annotations

import datetime as _dt
import logging
import random

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select

from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.menu import Restaurant
from app.services import mock_orders, platform_sync

logger = logging.getLogger(__name__)
settings = get_settings()

scheduler = AsyncIOScheduler()


async def _is_demo_enabled() -> bool:
    """Read the live demo_mode flag from restaurant.settings_json.

    Falls back to the env-var default if no restaurant row exists yet.
    """
    async with AsyncSessionLocal() as db:
        rest = (await db.execute(select(Restaurant).limit(1))).scalar_one_or_none()
        if not rest:
            return settings.demo_mode
        return bool((rest.settings_json or {}).get("demo_mode", settings.demo_mode))


def _schedule_next(delay_seconds: int) -> None:
    scheduler.add_job(
        _generate_and_reschedule,
        "date",
        id="demo_order_next",
        replace_existing=True,
        run_date=_dt.datetime.now().astimezone() + _dt.timedelta(seconds=delay_seconds),
    )


async def _generate_and_reschedule() -> None:
    """Generate one mock order if demo mode is on, then self-reschedule."""
    enabled = await _is_demo_enabled()
    if enabled:
        try:
            await mock_orders.generate_one()
        except Exception:
            logger.exception("mock order generation failed")
    else:
        logger.debug("demo mode off — skipping generation, no Claude call")

    # Always reschedule so the UI toggle can re-enable without a restart.
    delay = random.randint(settings.demo_order_interval_min, settings.demo_order_interval_max)
    _schedule_next(delay)
    logger.info("Next demo tick in %ds (enabled=%s)", delay, enabled)


def kick_demo_now(delay_seconds: int = 3) -> None:
    """Fire the next demo tick almost immediately. Called by the settings router
    when the user flips demo mode on so they don't have to wait a full cycle."""
    if scheduler.running:
        _schedule_next(delay_seconds)


def start_scheduler() -> None:
    """Wire up demo + sync jobs and start the scheduler."""
    if scheduler.running:
        return

    scheduler.add_job(
        platform_sync.poll_and_sync,
        IntervalTrigger(seconds=30),
        id="sync_poll",
        replace_existing=True,
    )
    scheduler.add_job(
        platform_sync.reconcile,
        IntervalTrigger(minutes=15),
        id="sync_reconcile",
        replace_existing=True,
    )

    # Always schedule the first demo tick — _generate_and_reschedule will gate
    # on the live DB flag, so this is a no-op when demo mode is off.
    _schedule_next(random.randint(5, 15))

    scheduler.start()
    logger.info("Scheduler started (demo gate is checked per-tick)")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
