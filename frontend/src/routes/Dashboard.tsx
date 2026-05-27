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
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat
          label="Pending review"
          value={pending.length}
          colorClass="bg-danger-500/8 text-danger-600 ring-1 ring-danger-500/20"
          delay={0}
        />
        <Stat
          label="Sent to kitchen"
          value={orders.filter((o) => o.status === "sent").length}
          colorClass="bg-good-500/8 text-good-500 ring-1 ring-good-500/20"
          delay={40}
        />
        <Stat
          label="Total today"
          value={orders.length}
          colorClass="bg-bridge-500/8 text-bridge-700 ring-1 ring-bridge-500/20"
          delay={80}
        />
      </div>

      {/* Pending section */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <AlertCircle size={18} className="text-danger-500" /> Pending review
          {pending.length > 0 && (
            <span className="ml-1 rounded-full bg-danger-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
              {pending.length}
            </span>
          )}
        </h2>
        {isLoading ? (
          <Skeleton />
        ) : pending.length === 0 ? (
          <Empty msg="No orders waiting — system is calm." />
        ) : (
          <div className="space-y-2">
            {pending.map((o, i) => (
              <div
                key={o.id}
                className="animate-enter"
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <OrderCard order={o} highlight />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-700">
          <ChefHat size={18} className="text-slate-500" /> Recent activity
        </h2>
        {recent.length === 0 ? (
          <Empty msg="Nothing yet — incoming demo orders will appear shortly." />
        ) : (
          <div className="space-y-2">
            {recent.map((o, i) => (
              <div
                key={o.id}
                className="animate-enter"
                style={{ animationDelay: `${i * 35}ms` }}
              >
                <OrderCard order={o} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  colorClass,
  delay,
}: {
  label: string;
  value: number;
  colorClass: string;
  delay: number;
}) {
  return (
    <div
      className={`animate-enter rounded-xl p-5 ${colorClass}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="text-4xl font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1.5 text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
    </div>
  );
}

function OrderCard({ order, highlight }: { order: OrderListItem; highlight?: boolean }) {
  return (
    <Link
      to={`/review/${order.id}`}
      className={`group flex items-center gap-4 rounded-xl border bg-white px-4 py-3.5 shadow-sm
                  transition-all duration-150 hover:shadow-md hover:-translate-y-px
                  active:scale-[0.99] active:shadow-sm
                  ${highlight ? "border-danger-500/60 ring-1 ring-danger-500/20" : "border-slate-200 hover:border-slate-300"}`}
    >
      <PlatformBadge platform={order.platform} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <span className="truncate">{order.customer_display_name}</span>
          <span className="text-slate-400">·</span>
          <span className="shrink-0 text-slate-600">{order.item_count} items</span>
          {order.has_allergies && (
            <span className="shrink-0 rounded bg-danger-500/10 px-2 py-0.5 text-xs font-bold text-danger-600">
              ALLERGY
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-400">
          AI confidence {Math.round(order.overall_confidence * 100)}%
          {" · "}
          {new Date(order.placed_at).toLocaleTimeString()}
          {" · "}
          <span className={`font-semibold ${statusColor(order.status)}`}>
            {statusLabel(order.status)}
          </span>
        </div>
      </div>
      {/* Arrow slides right on hover — spatial feedback */}
      <ArrowRight
        className="shrink-0 text-slate-300 transition-transform duration-150 group-hover:translate-x-1 group-hover:text-slate-400"
        size={18}
      />
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
    rejected: "text-slate-400",
  } as Record<string, string>)[s] ?? "text-slate-400";
}

const Empty = ({ msg }: { msg: string }) => (
  <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-400">
    {msg}
  </div>
);

const Skeleton = () => (
  <div className="space-y-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="h-[64px] animate-pulse rounded-xl bg-slate-100" />
    ))}
  </div>
);
