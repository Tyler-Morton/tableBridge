"""Authentication, password/PIN hashing, and JWT helpers."""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

# Argon2id with sensible defaults
pwd_ctx = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password with Argon2id."""
    return pwd_ctx.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its Argon2id hash."""
    try:
        return pwd_ctx.verify(password, hashed)
    except Exception:
        return False


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN with Argon2id (same primitive as password)."""
    return pwd_ctx.hash(pin)


def verify_pin(pin: str, hashed: str) -> bool:
    """Constant-time PIN verification."""
    try:
        return pwd_ctx.verify(pin, hashed)
    except Exception:
        return False


def create_access_token(subject: str, role: str, extra: dict[str, Any] | None = None) -> str:
    """Generate a short-lived JWT access token."""
    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token() -> tuple[str, str]:
    """Return (raw_token, sha256_hash) — only the hash is stored."""
    raw = secrets.token_urlsafe(48)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return raw, digest


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def decode_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT. Raises JWTError on failure."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def verify_jwt(token: str) -> dict[str, Any] | None:
    try:
        return decode_token(token)
    except JWTError:
        return None


def verify_hmac_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Verify an HMAC-SHA256 signature in 'sha256=...' format (constant time)."""
    if not signature:
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if signature.startswith("sha256="):
        signature = signature[len("sha256=") :]
    return hmac.compare_digest(expected, signature)


def sign_payload(payload: bytes, secret: str) -> str:
    """Generate an HMAC-SHA256 signature in 'sha256=...' format."""
    digest = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return f"sha256={digest}"
