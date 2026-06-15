"""Shared slowapi rate limiter.

Lives in its own module so routers can apply `@limiter.limit(...)` without a
circular import on main.py (which imports the routers). Keyed by client IP.
Disable in tests via RATE_LIMIT_ENABLED=false.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

settings = get_settings()

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.rate_limit_enabled,
)
