import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/orderStore";
import type { User } from "@/types";

export function useAuth() {
  const { user, accessToken, setUser, clear } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    if (accessToken && !user) {
      api<User>("/auth/me")
        .then((u) => !cancelled && setUser(u))
        .catch(() => !cancelled && clear());
    }
    return () => { cancelled = true; };
  }, [accessToken, user, setUser, clear]);

  const login = async (email: string, password: string) => {
    const tokens = await api<{ access_token: string; refresh_token: string }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
    );
    useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
    const me = await api<User>("/auth/me");
    setUser(me);
    return me;
  };

  const pinLogin = async (email: string, pin: string) => {
    const tokens = await api<{ access_token: string; refresh_token: string }>(
      "/auth/pin-login",
      { method: "POST", body: JSON.stringify({ email, pin }) },
    );
    useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token);
    const me = await api<User>("/auth/me");
    setUser(me);
    return me;
  };

  const logout = async () => {
    const refresh = useAuthStore.getState().refreshToken;
    if (refresh) {
      try {
        await api("/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh_token: refresh }),
        });
      } catch {/* swallow */}
    }
    clear();
    navigate("/login");
  };

  return { user, login, pinLogin, logout, isAuthed: !!accessToken };
}
