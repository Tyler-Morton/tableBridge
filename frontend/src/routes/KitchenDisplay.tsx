import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ChefHat, Clock, AlertTriangle } from "lucide-react";

interface KitchenTicket {
  toast_order_id: string;
  status: string;
  fired_at: string | null;
  payload: {
    platform: string;
    customer_first_name: string;
    items: Array<{
      menu_item_name: string;
      quantity: number;
      modifiers: { modifier_name: string }[];
      special_instructions: string | null;
    }>;
    allergies: string[];
    dietary: string[];
    kitchen_note?: string | null;
  };
}

const PLATFORM_CONFIG: Record<string, { border: string; dot: string; badge: string; label: string }> = {
  doordash: { border: "border-l-red-400", dot: "bg-red-500", badge: "bg-red-50 text-red-700", label: "DoorDash" },
  ubereats: { border: "border-l-emerald-400", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-800", label: "Uber Eats" },
  grubhub: { border: "border-l-orange-400", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700", label: "Grubhub" },
};

export default function KitchenDisplay() {
  const { data: tickets = [], isLoading } = useQuery<KitchenTicket[]>({
    queryKey: ["toast", "tickets"],
    queryFn: () => api("/toast/orders"),
    refetchInterval: 4000,
  });

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-700">
        <ChefHat size={18} className="text-slate-500" /> Kitchen display
        {tickets.length > 0 && (
          <span className="ml-1 rounded-full bg-bridge-500 px-2 py-0.5 text-xs font-bold text-white tabular-nums">
            {tickets.length}
          </span>
        )}
      </h2>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-400">
          No tickets yet. Send an order from the review screen to fire one.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tickets.map((t, i) => {
            const cfg = PLATFORM_CONFIG[t.payload.platform] ?? {
              border: "border-l-slate-300",
              dot: "bg-slate-400",
              badge: "bg-slate-100 text-slate-600",
              label: t.payload.platform,
            };
            const hasAllergy = (t.payload.allergies?.length ?? 0) > 0;

            return (
              <div
                key={t.toast_order_id}
                className={`animate-enter rounded-xl border border-slate-200 border-l-4 ${cfg.border} bg-white p-4 shadow-sm transition-shadow duration-150 hover:shadow-md`}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Ticket header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-800">
                        {t.payload.customer_first_name ?? "Customer"}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-slate-400">{t.toast_order_id}</div>
                  </div>
                  {t.fired_at && (
                    <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                      <Clock size={11} />
                      {new Date(t.fired_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                </div>

                {/* Allergy alert */}
                {hasAllergy && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-danger-500/20 bg-danger-500/8 px-3 py-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger-500 text-white">
                      <AlertTriangle size={11} strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-bold capitalize text-danger-600">
                      {t.payload.allergies.join(", ")}
                    </span>
                  </div>
                )}

                {/* Kitchen note */}
                {t.payload.kitchen_note && (
                  <div className="mb-3 rounded-lg border-l-2 border-warn-500 bg-warn-500/8 px-3 py-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-warn-500">Note </span>
                    <span className="text-xs italic text-slate-600">"{t.payload.kitchen_note}"</span>
                  </div>
                )}

                {/* Line items */}
                <ul className="space-y-1.5">
                  {t.payload.items?.map((it, j) => (
                    <li key={j} className="border-l-2 border-bridge-200 pl-2.5">
                      <div className="text-sm font-semibold text-slate-800">
                        {it.quantity}× {it.menu_item_name}
                      </div>
                      {it.modifiers?.length ? (
                        <div className="text-xs text-slate-500">
                          {it.modifiers.map((m) => m.modifier_name).join(" · ")}
                        </div>
                      ) : null}
                      {it.special_instructions && (
                        <div className="text-xs italic text-slate-400">"{it.special_instructions}"</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
