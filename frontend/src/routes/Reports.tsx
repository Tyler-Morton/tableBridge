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

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
        <BarChart3 size={18} className="text-slate-500" />
        Last {data.window_days} days
      </h2>

      {/* Top metric strip */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="Total orders"
          value={data.total_orders}
          accentClass="border-l-bridge-500 text-bridge-700"
          delay={0}
        />
        <MetricCard
          label="Avg AI confidence"
          value={`${Math.round(data.avg_ai_confidence * 100)}%`}
          accentClass="border-l-emerald-400 text-good-500"
          delay={40}
        />
        <MetricCard
          label="Flag rate"
          value={`${data.flagged_pct}%`}
          accentClass="border-l-amber-400 text-warn-500"
          delay={80}
        />
        <MetricCard
          label="Edit rate"
          value={`${data.edit_rate_pct}%`}
          accentClass="border-l-slate-300 text-slate-600"
          delay={120}
        />
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Orders per platform" delay={0}>
          <KvList obj={data.orders_per_platform} />
        </Panel>
        <Panel title="Review actions" delay={50}>
          <KvList obj={data.review_actions} />
        </Panel>
        <Panel title="86'd sync results" delay={100}>
          <KvList obj={data.sync_results} />
          <div className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
            Failure rate:{" "}
            <span className={`font-semibold ${data.sync_failure_pct > 10 ? "text-danger-600" : "text-slate-600"}`}>
              {data.sync_failure_pct}%
            </span>
          </div>
        </Panel>
        <Panel title="Allergies seen — last 30 days" delay={150}>
          <KvList obj={allergies} danger />
        </Panel>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accentClass,
  delay,
}: {
  label: string;
  value: number | string;
  accentClass: string;
  delay: number;
}) {
  return (
    <div
      className={`animate-enter rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${accentClass}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`text-3xl font-bold tabular-nums leading-none ${accentClass.split(" ").find(c => c.startsWith("text-")) ?? "text-slate-800"}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs font-medium text-slate-400">{label}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  delay,
}: {
  title: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <div
      className="animate-enter rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}

function KvList({ obj, danger }: { obj: Record<string, number>; danger?: boolean }) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return <div className="text-sm text-slate-400">None recorded.</div>;
  }
  const max = entries[0][1] || 1;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="capitalize text-slate-600">{k.replace("_", " ")}</span>
            <span className="font-semibold tabular-nums text-slate-800">{v}</span>
          </div>
          {/* Subtle progress bar */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-1 rounded-full transition-all duration-500 ${danger ? "bg-danger-500/60" : "bg-bridge-500/40"}`}
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
