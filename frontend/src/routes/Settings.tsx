import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { useSettingsStore } from "@/stores/orderStore";
import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon, Volume2, KeyRound } from "lucide-react";

interface Runtime {
  demo_mode: boolean;
  ai_confidence_threshold: number;
  alert_volume: number;
  platform_enabled: Record<string, boolean>;
}

interface CredEntry { platform: string; configured: boolean; configured_at: string | null }

interface AuditEntry { id: number; user_id: number | null; action: string; entity_type: string; entity_id: string | null; timestamp: string }

export default function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { alertVolume, setVolume } = useSettingsStore();
  const isOwner = user?.role === "owner";
  const isManager = user?.role === "owner" || user?.role === "manager";

  const { data: runtime } = useQuery<Runtime>({
    queryKey: ["settings", "runtime"], queryFn: () => api("/settings/runtime"),
    enabled: isManager,
  });
  const { data: creds = [] } = useQuery<CredEntry[]>({
    queryKey: ["settings", "credentials"], queryFn: () => api("/settings/credentials"),
    enabled: isManager,
  });
  const { data: audit = [] } = useQuery<AuditEntry[]>({
    queryKey: ["settings", "audit"], queryFn: () => api("/settings/audit-log?limit=50"),
    enabled: isManager,
  });

  const toggleDemo = useMutation({
    mutationFn: (enabled: boolean) =>
      api("/settings/runtime/demo", { method: "PUT", body: JSON.stringify({ enabled }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  const setThreshold = useMutation({
    mutationFn: (threshold: number) =>
      api("/settings/runtime/threshold", { method: "PUT", body: JSON.stringify({ threshold }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });

  const [credPlatform, setCredPlatform] = useState("doordash");
  const [credKey, setCredKey] = useState("");
  const upsertCred = useMutation({
    mutationFn: () =>
      api("/settings/credentials", {
        method: "PUT",
        body: JSON.stringify({ platform: credPlatform, fields: { api_key: credKey } }),
      }),
    onSuccess: () => { setCredKey(""); qc.invalidateQueries({ queryKey: ["settings"] }); },
  });

  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-700">
        <SettingsIcon size={22} /> Settings
      </h2>

      {!isManager && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600">
          Settings are only visible to managers and owners.
        </div>
      )}

      {isManager && runtime && (
        <Section title="Runtime">
          <Row label="Demo mode (auto-generates fake orders)">
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => toggleDemo.mutate(!runtime.demo_mode)}
              className={`relative h-6 w-11 rounded-full transition-colors duration-200
                          ${runtime.demo_mode ? "bg-good-500" : "bg-slate-200"}
                          disabled:cursor-not-allowed disabled:opacity-50`}
              aria-checked={runtime.demo_mode}
              role="switch"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200
                            ${runtime.demo_mode ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
          </Row>
          <Row label={`AI confidence threshold (${Math.round(runtime.ai_confidence_threshold * 100)}%)`}>
            <input
              type="range" min={0.5} max={1.0} step={0.05}
              defaultValue={runtime.ai_confidence_threshold}
              disabled={!isOwner}
              onMouseUp={(e) => setThreshold.mutate(Number((e.target as HTMLInputElement).value))}
              className="w-48"
            />
          </Row>
          <Row label={
            <span className="flex items-center gap-1"><Volume2 size={14} /> Alert volume</span>
          }>
            <input
              type="range" min={0} max={1} step={0.1}
              value={alertVolume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-48"
            />
            <span className="ml-2 text-xs text-slate-500">{Math.round(alertVolume * 100)}%</span>
          </Row>
        </Section>
      )}

      {isManager && (
        <Section title="Platform credentials">
          <p className="mb-2 text-xs text-slate-500">
            Stored encrypted at rest with AES-256-GCM. Values are never returned to the UI.
          </p>
          <ul className="mb-3 space-y-1">
            {creds.length === 0 ? (
              <li className="text-sm text-slate-400">No credentials yet.</li>
            ) : creds.map((c) => (
              <li key={c.platform} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                <span className="font-semibold capitalize">{c.platform}</span>
                <span className="text-xs text-good-500">✓ Configured</span>
              </li>
            ))}
          </ul>
          {isOwner && (
            <div className="flex items-center gap-2">
              <select value={credPlatform} onChange={(e) => setCredPlatform(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 text-sm">
                <option value="doordash">DoorDash</option>
                <option value="ubereats">Uber Eats</option>
                <option value="grubhub">Grubhub</option>
                <option value="toast">Toast POS</option>
              </select>
              <input
                value={credKey} onChange={(e) => setCredKey(e.target.value)}
                placeholder="API key (encrypted on save)"
                className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                onClick={() => upsertCred.mutate()}
                disabled={!credKey || upsertCred.isPending}
                className="flex items-center gap-1 rounded bg-bridge-500 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                <KeyRound size={14} /> Save
              </button>
            </div>
          )}
        </Section>
      )}

      {isManager && (
        <Section title="Audit log (last 50 entries)">
          <div className="max-h-80 overflow-auto rounded border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-2 py-1">Time</th>
                  <th className="px-2 py-1">User</th>
                  <th className="px-2 py-1">Action</th>
                  <th className="px-2 py-1">Entity</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id} className="border-t border-slate-100">
                    <td className="px-2 py-1 text-slate-500">{new Date(a.timestamp).toLocaleString()}</td>
                    <td className="px-2 py-1">{a.user_id ?? "—"}</td>
                    <td className="px-2 py-1 font-mono">{a.action}</td>
                    <td className="px-2 py-1 text-slate-600">{a.entity_type} {a.entity_id ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="mb-3 font-semibold text-slate-700">{title}</h3>
    {children}
  </section>
);

const Row = ({ label, children }: { label: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex items-center justify-between border-t border-slate-100 py-2 first:border-t-0">
    <div className="text-sm font-medium text-slate-600">{label}</div>
    <div>{children}</div>
  </div>
);
