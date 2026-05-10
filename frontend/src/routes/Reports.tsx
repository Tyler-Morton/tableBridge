import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { BarChart3 } from "lucide-react";

interface Summary {
  window_days: number;
  orders_per_platform: Record<string, number>;
  total_orders: number;
  avg_ai_confidence: number;
  flagged_orders: number;
  flagged_pct: number;
  review_actions: Record<string, number>;
  edited_orders: number;
  edit_rate_pct: number;
  sync_results: Record<string, number>;
  sync_failure_pct: number;
}

export default function Reports() {
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["reports", "summary"],
    queryFn: () => api("/reports/summary?days=7"),
  });
  const { data: allergies = {} } = useQuery<Record<string, number>>({
    queryKey: ["reports", "allergies"],
    queryFn: () => api("/reports/allergies?days=30"),
  });

  if (isLoading || !data) return <div className="text-slate-500">Loading reports…</div>;

  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-700">
        <BarChart3 size={22} /> Last {data.window_days} days
      </h2>

      <div className="grid grid-cols-4 gap-3">
        <Card label="Total orders" value={data.total_orders} />
        <Card label="Avg AI confidence" value={`${Math.round(data.avg_ai_confidence * 100)}%`} />
        <Card label="Flag rate" value={`${data.flagged_pct}%`} accent="text-warn-500" />
        <Card label="Edit rate" value={`${data.edit_rate_pct}%`} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Orders per platform">
          <KvList obj={data.orders_per_platform} />
        </Panel>
        <Panel title="Review actions">
          <KvList obj={data.review_actions} />
        </Panel>
        <Panel title="86'd-sync results">
          <KvList obj={data.sync_results} />
          <div className="mt-2 text-xs text-slate-500">
            Failure rate: <span className="font-semibold">{data.sync_failure_pct}%</span>
          </div>
        </Panel>
        <Panel title="Allergies seen (30 d)">
          <KvList obj={allergies} />
        </Panel>
      </div>
    </div>
  );
}

const Card = ({ label, value, accent = "text-bridge-700" }: { label: string; value: number | string; accent?: string }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className={`text-2xl font-bold ${accent}`}>{value}</div>
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
  </div>
);

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <h3 className="mb-2 font-semibold text-slate-700">{title}</h3>
    {children}
  </div>
);

const KvList = ({ obj }: { obj: Record<string, number> }) => (
  <ul className="space-y-1 text-sm">
    {Object.entries(obj).length === 0 ? (
      <li className="text-slate-400">— none —</li>
    ) : (
      Object.entries(obj)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => (
          <li key={k} className="flex justify-between">
            <span className="capitalize text-slate-600">{k}</span>
            <span className="font-semibold">{v}</span>
          </li>
        ))
    )}
  </ul>
);
