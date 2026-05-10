"""FastAPI application entry point — wires routers, middleware, scheduler, websockets."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import create_tables
from app.routers import (
    auth as auth_router,
)
from app.routers import (
    mock_toast as toast_router,
)
from app.routers import (
    orders as orders_router,
)
from app.routers import (
    reports as reports_router,
)
from app.routers import (
    reviews as reviews_router,
)
from app.routers import (
    settings as settings_router,
)
from app.routers import (
    sync as sync_router,
)
from app.routers import (
    webhooks as webhooks_router,
)
from app.scheduler import start_scheduler, stop_scheduler
from app.websockets import manager

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s — %(message)s")
logger = logging.getLogger(__name__)
settings = get_settings()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create tables + seed if empty + start scheduler.

    Shutdown: stop scheduler.
    """
    await create_tables()
    # Auto-seed on first run
    try:
        from seed_data import maybe_seed

        await maybe_seed()
    except Exception:  # noqa: BLE001
        logger.exception("Seed step failed — continuing")
    start_scheduler()
    logger.info("TableBridge backend ready — demo_mode=%s", settings.demo_mode)
    yield
    stop_scheduler()


app = FastAPI(
    title="TableBridge",
    description="Restaurant delivery order management middleware (demo MVP).",
    version="0.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Hardening response headers."""
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'"
    )
    return response


# Routers
app.include_router(auth_router.router)
app.include_router(webhooks_router.router)
app.include_router(orders_router.router)
app.include_router(reviews_router.router)
app.include_router(sync_router.router)
app.include_router(reports_router.router)
app.include_router(settings_router.router)
app.include_router(toast_router.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "tablebridge", "version": "0.1.0"}


@app.get("/")
async def root() -> dict[str, str]:
    return {
        "service": "tablebridge",
        "docs": "/docs",
        "health": "/health",
    }


@app.websocket("/ws/orders")
async def ws_orders(ws: WebSocket) -> None:
    """Real-time order events — frontend connects after login.

    Auth is via the `?token=...` query param (JWT).
    """
    from app.security import verify_jwt

    token = ws.query_params.get("token")
    if not token or not verify_jwt(token):
        await ws.close(code=1008)
        return

    await manager.connect(ws)
    try:
        while True:
            # Ignore client→server messages, but keep the connection alive.
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(ws)


@app.exception_handler(Exception)
async def fallback_exception(request: Request, exc: Exception) -> JSONResponse:
    """Don't leak internals in error bodies."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
