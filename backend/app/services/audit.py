"""Audit logging helper. Audit log is append-only at the application layer."""

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditLog


async def record(
    db: AsyncSession,
    *,
    user_id: int | None,
    action: str,
    entity_type: str = "",
    entity_id: str | None = None,
    before: dict[str, Any] | None = None,
    after: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> None:
    """Append a single audit-log entry. Caller must commit."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_json=before or {},
        after_json=after or {},
        ip_address=ip_address,
    )
    db.add(entry)
