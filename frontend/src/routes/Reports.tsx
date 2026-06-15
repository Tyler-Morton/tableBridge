import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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

interface TimePoint {
  day: string;
  date: string;
  doordash: number;
  ubereats: number;
  grubhub: number;
  total: number;
}

const PLATFORM_COLORS: Record<string, string> = {
  doordash: "#ef4444",
  ubereats: "#10b981",
  grubhub: "#f97316",
};

const PLATFORM_LABELS: Record<string, string> = {
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  grubhub: "Grubhub",
};

const tooltipStyle = {
  borderRadius: "0.5rem",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  fontSize: "12px",
  padding: "8px 12px",
};

export default function Reports() {
  const { data, isLoading } = useQuery<Summary>({
    queryKey: ["reports", "summary"],
    queryFn: () => api("/reports/summary?days=7"),
  });
  const { data: series = [] } = useQuery<TimePoint[]>({
    queryKey: ["reports", "timeseries"],
    queryFn: () => api("/reports/timeseries?days=14"),
  });
  const { data: allergies = {} } = useQuery<Record<string, number>>({
    queryKey: ["reports", "allergies"],
    queryFn: () => api("/reports/allergies?days=30"),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  const platformData = Object.entries(data.orders_per_platform).map(([k, v]) => ({
    name: PLATFORM_LABELS[k] ?? k,
    value: v,
    color: PLATFORM_COLORS[k] ?? "#94a3b8",
  }));

  const allergyData = Object.entries(allergies)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k, v]) => ({ name: k, count: v }));

  const actionData = Object.entries(data.review_actions).map(([k, v]) => ({
    name: k,
    count: v,
  }));

  return (
    <div className="space-y-5">
      <h2 className="flex items-center gap-2 text-base font-bold text-slate-700">
        <BarChart3 size={18} className="text-slate-500" />
        Last {data.window_days} days
      </h2>

      {/* Top metric strip */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard label="Total orders" value={data.total_orders} accent="text-bridge-700" border="border-l-bridge-500" delay={0} />
        <MetricCard label="Avg AI confidence" value={`${Math.round(data.avg_ai_confidence * 100)}%`} accent="text-good-500" border="border-l-emerald-400" delay={40} />
        <MetricCard label="Flag rate" value={`${data.flagged_pct}%`} accent="text-warn-500" border="border-l-amber-400" delay={80} />
        <MetricCard label="Edit rate" value={`${data.edit_rate_pct}%`} accent="text-slate-600" border="border-l-slate-300" delay={120} />
      </div>

      {/* Order volume over time — stacked area */}
      <ChartPanel title="Order volume — last 14 days">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                {Object.entries(PLATFORM_COLORS).map(([k, color]) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                ))}
              </defs>
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              {(["doordash", "ubereats", "grubhub"] as const).map((p) => (
                <Area
                  key={p}
                  type="monotone"
                  dataKey={p}
                  name={PLATFORM_LABELS[p]}
                  stackId="1"
                  stroke={PLATFORM_COLORS[p]}
                  strokeWidth={2}
                  fill={`url(#grad-${p})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartPanel>

      {/* Platform donut + review actions */}
      <div className="grid grid-cols-2 gap-4">
        <ChartPanel title="Orders per platform">
          <div className="flex items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platformData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {platformData.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2">
              {platformData.map((d) => (
                <li key={d.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold tabular-nums text-slate-800">{d.value}</span>
                </li>
              ))}
              {platformData.length === 0 && (
                <li className="text-sm text-slate-400">No orders yet.</li>
              )}
            </ul>
          </div>
        </ChartPanel>

        <ChartPanel title="Review actions">
          {actionData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">
              No reviews yet.
            </div>
          ) : (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actionData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(59,95,182,0.06)" }} />
                  <Bar dataKey="count" fill="#3b5fb6" radius={[4, 4, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartPanel>
      </div>

      {/* Allergies + sync */}
      <div className="grid grid-cols-2 gap-4">
        <ChartPanel title="Allergies flagged — last 30 days">
          {allergyData.length === 0 ? (
            <div className="flex h-44 items-center justify-center text-sm text-slate-400">
              None recorded.
            </div>
          ) : (
            <div className="w-full" style={{ height: Math.max(allergyData.length * 32, 100) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allergyData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "#475569" }}
                    tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)}
                    axisLine={false}
                    tickLine={false}
                    width={80}
                  />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(220,38,38,0.06)" }} />
                  <Bar dataKey="count" fill="#dc2626" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartPanel>

        <ChartPanel title="86'd sync results">
          <ul className="space-y-2.5">
            {Object.entries(data.sync_results).length === 0 ? (
              <li className="text-sm text-slate-400">No sync activity.</li>
            ) : (
              Object.entries(data.sync_results)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize text-slate-600">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          k === "success" ? "bg-good-500" : k === "failure" ? "bg-danger-500" : "bg-slate-400"
                        }`}
                      />
                      {k}
                    </span>
                    <span className="font-semibold tabular-nums text-slate-800">{v}</span>
                  </li>
                ))
            )}
          </ul>
          <div className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            Failure rate:{" "}
            <span className={`font-semibold ${data.sync_failure_pct > 10 ? "text-danger-600" : "text-slate-700"}`}>
              {data.sync_failure_pct}%
            </span>
          </div>
        </ChartPanel>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent,
  border,
  delay,
}: {
  label: string;
  value: number | string;
  accent: string;
  border: string;
  delay: number;
}) {
  return (
    <div
      className={`animate-enter rounded-xl border border-slate-200 border-l-4 bg-white p-4 shadow-sm ${border}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`text-3xl font-bold tabular-nums leading-none ${accent}`}>{value}</div>
      <div className="mt-1.5 text-xs font-medium text-slate-400">{label}</div>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </div>
  );
}
