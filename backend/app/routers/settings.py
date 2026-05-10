"""Restaurant + platform settings, audit log viewer, demo-mode toggle."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import require_manager, require_owner
from app.models.audit import AuditLog
from app.models.auth import User
from app.models.menu import ApiCredential, Restaurant
from app.services import audit
from app.services.encryption import encrypt_json

settings_global = get_settings()
router = APIRouter(prefix="/settings", tags=["settings"])


class RestaurantUpdate(BaseModel):
    name: str | None = None
    timezone: str | None = None
    settings_json: dict[str, Any] | None = None


class CredentialPayload(BaseModel):
    """Credential payload — accepts arbitrary fields per platform."""

    platform: str = Field(min_length=2, max_length=50)
    fields: dict[str, str]


class DemoToggle(BaseModel):
    enabled: bool


class ConfidenceThreshold(BaseModel):
    threshold: float = Field(ge=0.0, le=1.0)


class AlertVolume(BaseModel):
    volume: float = Field(ge=0.0, le=1.0)


@router.get("/restaurant")
async def get_restaurant(
    user: User = Depends(require_manager), db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one_or_none()
    if not rest:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No restaurant configured")
    return {
        "id": rest.id,
        "name": rest.name,
        "timezone": rest.timezone,
        "settings": rest.settings_json,
    }


@router.patch("/restaurant")
async def update_restaurant(
    payload: RestaurantUpdate,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one_or_none()
    if not rest:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No restaurant configured")
    before = {"name": rest.name, "timezone": rest.timezone, "settings": rest.settings_json}
    if payload.name is not None:
        rest.name = payload.name
    if payload.timezone is not None:
        rest.timezone = payload.timezone
    if payload.settings_json is not None:
        rest.settings_json = {**(rest.settings_json or {}), **payload.settings_json}
    await audit.record(
        db,
        user_id=user.id,
        action="restaurant_updated",
        entity_type="restaurant",
        entity_id=str(rest.id),
        before=before,
        after={"name": rest.name, "timezone": rest.timezone, "settings": rest.settings_json},
    )
    return {"id": rest.id, "name": rest.name, "settings": rest.settings_json}


@router.get("/credentials")
async def list_credentials(
    user: User = Depends(require_manager), db: AsyncSession = Depends(get_db)
) -> list[dict[str, Any]]:
    """Never return actual credential values — only existence + metadata."""
    creds = (await db.execute(select(ApiCredential))).scalars().all()
    return [
        {
            "platform": c.platform,
            "configured": True,
            "configured_at": c.configured_at.isoformat() if c.configured_at else None,
            "last_used_at": c.last_used_at.isoformat() if c.last_used_at else None,
        }
        for c in creds
    ]


@router.put("/credentials")
async def upsert_credential(
    payload: CredentialPayload,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one()
    existing = (
        await db.execute(
            select(ApiCredential).where(
                ApiCredential.restaurant_id == rest.id,
                ApiCredential.platform == payload.platform,
            )
        )
    ).scalar_one_or_none()
    if existing:
        existing.encrypted_payload = encrypt_json(payload.fields)
    else:
        db.add(
            ApiCredential(
                restaurant_id=rest.id,
                platform=payload.platform,
                encrypted_payload=encrypt_json(payload.fields),
            )
        )
    await audit.record(
        db, user_id=user.id, action="credential_set",
        entity_type="api_credential", entity_id=payload.platform,
        before={}, after={"platform": payload.platform, "field_keys": list(payload.fields)},
    )
    return {"status": "ok", "platform": payload.platform}


@router.get("/audit-log")
async def view_audit_log(
    limit: int = Query(default=100, le=500),
    user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = (
        await db.execute(select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit))
    ).scalars().all()
    return [
        {
            "id": r.id,
            "user_id": r.user_id,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": r.entity_id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "ip_address": r.ip_address,
        }
        for r in rows
    ]


# ── Runtime feature toggles (in-memory, persist via restaurant settings_json) ──


@router.get("/runtime")
async def runtime_settings(
    user: User = Depends(require_manager), db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one_or_none()
    s = (rest.settings_json or {}) if rest else {}
    return {
        "demo_mode": s.get("demo_mode", settings_global.demo_mode),
        "ai_confidence_threshold": s.get(
            "ai_confidence_threshold", settings_global.ai_confidence_threshold
        ),
        "alert_volume": s.get("alert_volume", 0.7),
        "platform_enabled": s.get(
            "platform_enabled", {"doordash": True, "ubereats": True, "grubhub": True}
        ),
    }


@router.put("/runtime/demo")
async def toggle_demo(
    payload: DemoToggle,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one()
    rest.settings_json = {**(rest.settings_json or {}), "demo_mode": payload.enabled}
    await audit.record(
        db, user_id=user.id, action="demo_toggle",
        entity_type="settings", after={"demo_mode": payload.enabled},
    )
    # When re-enabling, kick the next tick immediately instead of waiting up
    # to 90s for the rolling schedule.
    if payload.enabled:
        from app.scheduler import kick_demo_now

        kick_demo_now(delay_seconds=3)
    return {"demo_mode": payload.enabled}


@router.put("/runtime/threshold")
async def set_threshold(
    payload: ConfidenceThreshold,
    user: User = Depends(require_owner),
    db: AsyncSession = Depends(get_db),
) -> dict[str, float]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one()
    rest.settings_json = {
        **(rest.settings_json or {}),
        "ai_confidence_threshold": payload.threshold,
    }
    await audit.record(
        db, user_id=user.id, action="threshold_changed",
        entity_type="settings", after={"threshold": payload.threshold},
    )
    return {"threshold": payload.threshold}


@router.put("/runtime/volume")
async def set_volume(
    payload: AlertVolume,
    user: User = Depends(require_manager),
    db: AsyncSession = Depends(get_db),
) -> dict[str, float]:
    rest = (await db.execute(select(Restaurant).limit(1))).scalar_one()
    rest.settings_json = {**(rest.settings_json or {}), "alert_volume": payload.volume}
    return {"volume": payload.volume}
