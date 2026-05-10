import { useEffect, useRef } from "react";
import { useAuthStore, useOrderStore } from "@/stores/orderStore";
import { useAudio } from "./useAudio";
import type { WSEvent } from "@/types";

/**
 * Connects to /ws/orders, dispatches events to the order store, and
 * auto-plays the alert chime on every new_order event.
 */
export function useWebSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const pushAlert = useOrderStore((s) => s.pushAlert);
  const wsRef = useRef<WebSocket | null>(null);
  const { playLoop } = useAudio();

  useEffect(() => {
    if (!accessToken) return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${window.location.host}/ws/orders?token=${encodeURIComponent(accessToken)}`;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onmessage = (msg) => {
        try {
          const evt = JSON.parse(msg.data) as WSEvent;
          if (evt.event === "new_order") {
            pushAlert(evt.data as never);
            playLoop();
          }
          // Other events (sync_alert, kitchen_ticket, order_reviewed) bubble
          // up to React Query invalidations elsewhere.
          window.dispatchEvent(new CustomEvent("tb_event", { detail: evt }));
        } catch (e) {
          console.error("ws parse error", e);
        }
      };
      ws.onclose = () => {
        if (!stopped) setTimeout(connect, 2000);
      };
      ws.onerror = () => ws.close();
    };
    connect();

    return () => {
      stopped = true;
      wsRef.current?.close();
    };
  }, [accessToken, pushAlert, playLoop]);
}
