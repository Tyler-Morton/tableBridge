import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Hash, KeyRound } from "lucide-react";

export default function Login() {
  const { login, pinLogin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"pin" | "password">("pin");
  const [email, setEmail] = useState("server@tablebridge.demo");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "pin") {
        await pinLogin(email, pin);
      } else {
        await login(email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-bridge-50 to-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl ring-1 ring-slate-200/60">
        {/* Brand */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bridge-500 text-white text-sm font-bold shadow-md">
            TB
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-bridge-900">TableBridge</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to your tablet</p>
        </div>

        {/* Mode toggle — clip-path reveals active indicator */}
        <div className="relative mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          {/* Sliding pill */}
          <div
            className="absolute inset-y-1 w-[calc(50%-4px)] rounded-md bg-white shadow transition-transform duration-200 ease-out"
            style={{ transform: mode === "password" ? "translateX(calc(100% + 8px))" : "translateX(0)" }}
          />
          <button
            onClick={() => setMode("pin")}
            className={`relative flex items-center justify-center gap-1.5 rounded-md py-2 transition-colors duration-150 ${
              mode === "pin" ? "text-bridge-700" : "text-slate-500"
            }`}
            type="button"
          >
            <Hash size={14} /> PIN
          </button>
          <button
            onClick={() => setMode("password")}
            className={`relative flex items-center justify-center gap-1.5 rounded-md py-2 transition-colors duration-150 ${
              mode === "password" ? "text-bridge-700" : "text-slate-500"
            }`}
            type="button"
          >
            <KeyRound size={14} /> Password
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-colors duration-150 focus:bg-white"
            />
          </div>

          {mode === "pin" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                4-digit PIN
              </label>
              <input
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center text-2xl tracking-[0.6em] transition-colors duration-150 focus:bg-white"
                placeholder="• • • •"
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition-colors duration-150 focus:bg-white"
              />
            </div>
          )}

          {error && (
            <div className="animate-enter rounded-lg bg-danger-500/10 px-3 py-2.5 text-sm font-medium text-danger-600">
              {error}
            </div>
          )}

          <button
            disabled={busy}
            className="w-full rounded-lg bg-bridge-500 py-3 text-sm font-bold text-white shadow-sm
                       transition-all duration-150 hover:bg-bridge-600
                       active:scale-[0.98] active:shadow-none
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <div className="mb-1.5 font-semibold text-slate-600">Demo accounts</div>
          <ul className="space-y-1">
            <li>owner@tablebridge.demo · PIN 1234</li>
            <li>manager@tablebridge.demo · PIN 5678</li>
            <li>server@tablebridge.demo · PIN 9999</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
