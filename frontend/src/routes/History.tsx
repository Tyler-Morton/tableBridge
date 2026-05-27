import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderListItem, Platform } from "@/types";
import { PlatformBadge } from "@/components/PlatformBadge";
import { Filter, Download, AlertTriangle } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  pending_review: "bg-danger-500/10 text-danger-600",
  sent: "bg-good-500/10 text-good-500",
  flagged: "bg-warn-500/10 text-warn-500",
  rejected: "bg-slate-100 text-slate-500",
};

export default function History() {
  const [platform, setPlatform] = useState<Platform | "">("");
  const [flagged, setFlagged] = useState(false);

  const { data = [], isLoading } = useQuery<OrderListItem[]>({
    queryKey: ["history", platform, flagged],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (platform) qs.set("platform", platform);
      if (flagged) qs.set("flagged_only", "true");
      qs.set("limit", "100");
      return api(`/orders?${qs}`);
    },
  });

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-base font-bold text-slate-700">History</h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 tabular-nums">
          {data.length}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm shadow-sm">
            <Filter size={13} className="text-slate-400" />
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform | "")}
              className="border-none bg-transparent text-sm text-slate-600 outline-none"
            >
              <option value="">All platforms</option>
              <option value="doordash">DoorDash</option>
              <option value="ubereats">Uber Eats</option>
              <option value="grubhub">Grubhub</option>
            </select>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
              className="accent-bridge-500"
            />
            Flagged only
          </label>
          <a
            href="/api/reports/orders.csv?days=30"
            className="flex items-center gap-1.5 rounded-lg bg-bridge-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm
                       transition-all duration-150 hover:bg-bridge-600 active:scale-[0.97]"
          >
            <Download size={13} /> Export CSV
          </a>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          No orders match the current filters.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Platform</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Customer</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Time</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Items</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Confidence</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {data.map((o, i) => (
                <tr
                  key={o.id}
                  className="animate-enter border-t border-slate-100 transition-colors duration-100 hover:bg-slate-50/80"
                  style={{ animationDelay: `${Math.min(i * 20, 300)}ms` }}
                >
                  <td className="px-4 py-2.5">
                    <PlatformBadge platform={o.platform} />
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                      {o.customer_display_name}
                      {o.has_allergies && (
                        <AlertTriangle size={13} className="shrink-0 text-danger-500" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {new Date(o.placed_at).toLocaleString([], {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{o.item_count}</td>
                  <td className="px-4 py-2.5">
                    <span className={`tabular-nums font-semibold ${
                      o.overall_confidence >= 0.9 ? "text-good-500" :
                      o.overall_confidence >= 0.75 ? "text-warn-500" :
                      "text-danger-600"
                    }`}>
                      {Math.round(o.overall_confidence * 100)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      STATUS_STYLES[o.status] ?? "bg-slate-100 text-slate-500"
                    }`}>
                      {o.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/review/${o.id}`}
                      className="text-xs font-semibold text-bridge-500 transition-colors duration-100 hover:text-bridge-700"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
