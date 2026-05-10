import { useAuthStore } from "@/stores/orderStore";

const BASE = "/api";

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function refresh(): Promise<string | null> {
  const refresh_token = useAuthStore.getState().refreshToken;
  if (!refresh_token) return null;
  const r = await fetch(`${BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!r.ok) {
    useAuthStore.getState().clear();
    return null;
  }
  const data = await r.json();
  useAuthStore.getState().setTokens(data.access_token, data.refresh_token);
  return data.access_token;
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = useAuthStore.getState().accessToken;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let resp = await fetch(`${BASE}${path}`, { ...init, headers });

  if (resp.status === 401 && useAuthStore.getState().refreshToken) {
    const newAccess = await refresh();
    if (newAccess) {
      headers.set("Authorization", `Bearer ${newAccess}`);
      resp = await fetch(`${BASE}${path}`, { ...init, headers });
    }
  }

  if (!resp.ok) {
    let message = resp.statusText;
    try {
      const data = await resp.json();
      if (data.detail) message = String(data.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(resp.status, message);
  }
  if (resp.status === 204) return undefined as T;

  const ct = resp.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await resp.json()) as T;
  return (await resp.text()) as unknown as T;
}

export { ApiError };
