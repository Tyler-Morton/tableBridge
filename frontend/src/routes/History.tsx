import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { OrderListItem, Platform } from "@/types";
import { PlatformBadge } from "@/components/PlatformBadge";
import { Filter, Download } from "lucide-react";

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
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-700">History</h2>
        <span className="text-sm text-slate-500">{data.length} orders</span>
        <div className="ml-auto flex items-center gap-2">
          <Filter size={16} className="text-slate-500" />
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform | "")}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="">All platforms</option>
            <option value="doordash">DoorDash</option>
            <option value="ubereats">Uber Eats</option>
            <option value="grubhub">Grubhub</option>
          </select>
          <label className="flex items-center gap-1 text-sm text-slate-600">
            <input type="checkbox" checked={flagged} onChange={(e) => setFlagged(e.target.checked)} />
            Flagged only
          </label>
          <a
            href="/api/reports/orders.csv?days=30"
            className="flex items-center gap-1 rounded bg-bridge-500 px-3 py-1.5 text-xs font-semibold text-white"
          >
            <Download size={14} /> Export
          </a>
        </div>
      </div>

      {isLoading ? (
        <div className="text-slate-500">Loading…</div>
      ) : data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
          No orders match.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Platform</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2"><PlatformBadge platform={o.platform} /></td>
                  <td className="px-3 py-2 font-semibold">
                    {o.customer_display_name}
                    {o.has_allergies && <span className="ml-2 text-danger-500">⚠</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{new Date(o.placed_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{o.item_count}</td>
                  <td className="px-3 py-2">{Math.round(o.overall_confidence * 100)}%</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold uppercase">
                      {o.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Link to={`/review/${o.id}`} className="text-bridge-500 hover:underline">View</Link>
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
