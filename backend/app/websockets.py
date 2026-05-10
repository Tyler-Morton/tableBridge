"""WebSocket connection manager — broadcasts new orders & sync alerts to tablets."""

import asyncio
import json
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Tracks active WebSocket clients and broadcasts events."""

    def __init__(self) -> None:
        self.active: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.active.add(ws)
        logger.info("WS connected — total clients: %d", len(self.active))

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self.active.discard(ws)
        logger.info("WS disconnected — total clients: %d", len(self.active))

    async def broadcast(self, event: str, data: dict[str, Any]) -> None:
        """Broadcast a JSON event to every connected client."""
        message = json.dumps({"event": event, "data": data}, default=str)
        async with self._lock:
            stale: list[WebSocket] = []
            for ws in self.active:
                try:
                    await ws.send_text(message)
                except Exception:  # noqa: BLE001
                    stale.append(ws)
            for ws in stale:
                self.active.discard(ws)


manager = ConnectionManager()
