import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, OrderListItem } from "@/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (access: string, refresh: string) => void;
  setUser: (u: User | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: "tablebridge-auth" },
  ),
);

interface IncomingOrder {
  raw_id: number;
  parsed_id: number;
  platform: string;
  customer_display_name: string;
  overall_confidence: number;
  flagged: boolean;
  has_allergies: boolean;
  item_count: number;
  placed_at: string;
}

interface OrderState {
  pendingAlerts: IncomingOrder[];
  pushAlert: (o: IncomingOrder) => void;
  dismissAlert: (rawId: number) => void;
  clearAlerts: () => void;
  recentOrders: OrderListItem[];
  setRecentOrders: (orders: OrderListItem[]) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  pendingAlerts: [],
  pushAlert: (o) =>
    set((s) => ({
      pendingAlerts: s.pendingAlerts.some((p) => p.raw_id === o.raw_id)
        ? s.pendingAlerts
        : [o, ...s.pendingAlerts],
    })),
  dismissAlert: (rawId) =>
    set((s) => ({ pendingAlerts: s.pendingAlerts.filter((a) => a.raw_id !== rawId) })),
  clearAlerts: () => set({ pendingAlerts: [] }),
  recentOrders: [],
  setRecentOrders: (recentOrders) => set({ recentOrders }),
}));

interface SettingsState {
  alertVolume: number;
  setVolume: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      alertVolume: 0.7,
      setVolume: (alertVolume) => set({ alertVolume }),
    }),
    { name: "tablebridge-settings" },
  ),
);
