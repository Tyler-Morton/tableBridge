"""Login, PIN login, refresh, logout."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.auth import RefreshToken, User
from app.ratelimit import limiter
from app.schemas.auth import (
    LoginRequest,
    PinLoginRequest,
    RefreshRequest,
    TokenPair,
    UserOut,
)
from app.security import (
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    verify_password,
    verify_pin,
)
from app.services import audit

settings = get_settings()
router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    return get_remote_address(request) or "unknown"


async def _check_lockout(user: User) -> None:
    if user.locked_until and user.locked_until > datetime.now(UTC):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Account locked until {user.locked_until.isoformat()}",
        )


async def _record_failure(db: AsyncSession, user: User) -> None:
    user.failed_attempts += 1
    if user.failed_attempts >= settings.pin_max_attempts:
        user.locked_until = datetime.now(UTC) + timedelta(minutes=settings.pin_lockout_minutes)
        user.failed_attempts = 0


async def _issue_tokens(db: AsyncSession, user: User) -> TokenPair:
    access = create_access_token(str(user.id), user.role.value)
    raw_refresh, digest = create_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=digest,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    user.last_login = datetime.now(UTC)
    user.failed_attempts = 0
    user.locked_until = None
    return TokenPair(access_token=access, refresh_token=raw_refresh)


@router.post("/login", response_model=TokenPair)
@limiter.limit(settings.auth_rate_limit)
async def login(
    payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenPair:
    """Email + password login (owner / manager flow)."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not user.active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    await _check_lockout(user)

    if not verify_password(payload.password, user.password_hash):
        await _record_failure(db, user)
        await audit.record(
            db, user_id=user.id, action="login_failed",
            entity_type="user", entity_id=str(user.id), ip_address=_client_ip(request),
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    tokens = await _issue_tokens(db, user)
    await audit.record(
        db, user_id=user.id, action="login_success",
        entity_type="user", entity_id=str(user.id), ip_address=_client_ip(request),
    )
    return tokens


@router.post("/pin-login", response_model=TokenPair)
@limiter.limit(settings.auth_rate_limit)
async def pin_login(
    payload: PinLoginRequest, request: Request, db: AsyncSession = Depends(get_db)
) -> TokenPair:
    """4-digit PIN login (server quick-login on tablet)."""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not user.active or not user.pin_hash:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    await _check_lockout(user)

    if not verify_pin(payload.pin, user.pin_hash):
        await _record_failure(db, user)
        await audit.record(
            db, user_id=user.id, action="pin_login_failed",
            entity_type="user", entity_id=str(user.id), ip_address=_client_ip(request),
        )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid PIN")

    tokens = await _issue_tokens(db, user)
    await audit.record(
        db, user_id=user.id, action="pin_login_success",
        entity_type="user", entity_id=str(user.id), ip_address=_client_ip(request),
    )
    return tokens


@router.post("/refresh", response_model=TokenPair)
async def refresh(
    payload: RefreshRequest, db: AsyncSession = Depends(get_db)
) -> TokenPair:
    """Rotate the refresh token (one-time use)."""
    digest = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == digest)
    )
    rt = result.scalar_one_or_none()
    if not rt or rt.revoked or rt.expires_at < datetime.now(UTC):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid refresh token")

    rt.revoked = True  # rotate
    user = (await db.execute(select(User).where(User.id == rt.user_id))).scalar_one()
    return await _issue_tokens(db, user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    payload: RefreshRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Revoke a refresh token."""
    digest = hash_refresh_token(payload.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == digest)
    )
    rt = result.scalar_one_or_none()
    if rt:
        rt.revoked = True


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
