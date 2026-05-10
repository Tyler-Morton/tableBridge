import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, Hash, KeyRound } from "lucide-react";

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
    <div className="flex min-h-screen items-center justify-center bg-bridge-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-bridge-500 text-white">
            <LogIn size={24} />
          </div>
          <h1 className="text-2xl font-bold text-bridge-900">TableBridge</h1>
          <p className="text-sm text-slate-500">Sign in to your tablet</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          <button
            onClick={() => setMode("pin")}
            className={`flex items-center justify-center gap-1 rounded-md py-2 ${mode === "pin" ? "bg-white shadow text-bridge-700" : "text-slate-500"}`}
            type="button"
          >
            <Hash size={14} /> PIN
          </button>
          <button
            onClick={() => setMode("password")}
            className={`flex items-center justify-center gap-1 rounded-md py-2 ${mode === "password" ? "bg-white shadow text-bridge-700" : "text-slate-500"}`}
            type="button"
          >
            <KeyRound size={14} /> Password
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase text-slate-500">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          {mode === "pin" ? (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">4-digit PIN</label>
              <input
                inputMode="numeric"
                pattern="\d{4}"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-2xl tracking-[0.5em]"
                placeholder="• • • •"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          )}
          {error && (
            <div className="rounded bg-danger-500/10 px-3 py-2 text-sm text-danger-600">
              {error}
            </div>
          )}
          <button
            disabled={busy}
            className="w-full rounded-lg bg-bridge-500 py-3 text-base font-bold text-white shadow hover:bg-bridge-600 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-5 rounded bg-slate-50 p-3 text-xs text-slate-500">
          <div className="font-semibold text-slate-700">Demo accounts</div>
          <ul className="mt-1 space-y-0.5">
            <li>owner@tablebridge.demo · PIN 1234 · pw OwnerPass!2024</li>
            <li>manager@tablebridge.demo · PIN 5678 · pw ManagerPass!2024</li>
            <li>server@tablebridge.demo · PIN 9999 · pw ServerPass!2024</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
