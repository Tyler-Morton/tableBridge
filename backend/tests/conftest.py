"""Pytest fixtures — in-memory test DB."""

import os
import secrets

# Set required env vars before importing the app
os.environ.setdefault("ENCRYPTION_KEY", secrets.token_hex(32))
os.environ.setdefault("JWT_SECRET_KEY", secrets.token_hex(32))
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("ANTHROPIC_API_KEY", "")  # heuristic fallback path
os.environ.setdefault("DEMO_MODE", "false")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.database import create_tables


@pytest_asyncio.fixture(autouse=True)
async def _setup_db():
    await create_tables()
    yield


@pytest_asyncio.fixture
async def client():
    from app.main import app

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
