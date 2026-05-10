import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { PlatformBadge } from "@/components/PlatformBadge";
import type { OrderListItem } from "@/types";
import { ArrowRight, AlertCircle, ChefHat } from "lucide-react";

export default function Dashboard() {
  const { data: orders = [], isLoading } = useQuery<OrderListItem[]>({
    queryKey: ["orders", "recent"],
    queryFn: () => api("/orders?limit=20"),
    refetchInterval: 5_000,
  });

  const pending = orders.filter((o) => o.status === "pending_review");
  const recent = orders.filter((o) => o.status !== "pending_review").slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Pending review" value={pending.length} accent="bg-danger-500/10 text-danger-600" />
        <Stat label="Sent today" value={orders.filter((o) => o.status === "sent").length} accent="bg-good-500/10 text-good-500" />
        <Stat label="Total today" value={orders.length} accent="bg-bridge-500/10 text-bridge-700" />
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-700">
          <AlertCircle size={20} /> Pending review
        </h2>
        {isLoading ? <Skeleton /> : pending.length === 0 ? (
          <Empty msg="No orders waiting — system is calm." />
        ) : (
          <div className="space-y-2">
            {pending.map((o) => <OrderCard key={o.id} order={o} highlight />)}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-slate-700">
          <ChefHat size={20} /> Recent activity
        </h2>
        {recent.length === 0 ? (
          <Empty msg="Nothing yet — incoming demo orders will appear shortly." />
        ) : (
          <div className="space-y-2">{recent.map((o) => <OrderCard key={o.id} order={o} />)}</div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className={`rounded-xl p-4 ${accent}`}>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-sm font-semibold uppercase tracking-wide opacity-80">{label}</div>
    </div>
  );
}

function OrderCard({ order, highlight }: { order: OrderListItem; highlight?: boolean }) {
  return (
    <Link
      to={`/review/${order.id}`}
      className={`flex items-center gap-4 rounded-lg border bg-white px-4 py-3 shadow-sm hover:bg-slate-50 ${
        highlight ? "border-danger-500" : "border-slate-200"
      }`}
    >
      <PlatformBadge platform={order.platform} />
      <div className="flex-1">
        <div className="font-semibold text-slate-800">
          {order.customer_display_name} · {order.item_count} items
          {order.has_allergies && (
            <span className="ml-2 rounded bg-danger-500/10 px-2 py-0.5 text-xs font-bold text-danger-600">
              ALLERGY
            </span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          Confidence {Math.round(order.overall_confidence * 100)}% · {new Date(order.placed_at).toLocaleTimeString()} ·{" "}
          <span className={`font-semibold ${statusColor(order.status)}`}>{statusLabel(order.status)}</span>
        </div>
      </div>
      <ArrowRight className="text-slate-400" size={18} />
    </Link>
  );
}

function statusLabel(s: string) {
  return ({
    pending_review: "Pending review",
    sent: "Sent to kitchen",
    flagged: "Flagged",
    rejected: "Rejected",
  } as Record<string, string>)[s] ?? s;
}

function statusColor(s: string) {
  return ({
    pending_review: "text-danger-600",
    sent: "text-good-500",
    flagged: "text-warn-500",
    rejected: "text-slate-500",
  } as Record<string, string>)[s] ?? "text-slate-500";
}

const Empty = ({ msg }: { msg: string }) => (
  <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500">{msg}</div>
);
const Skeleton = () => <div className="h-12 animate-pulse rounded bg-slate-200" />;
