import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { ChefHat, Clock } from "lucide-react";

interface KitchenTicket {
  toast_order_id: string;
  status: string;
  fired_at: string | null;
  payload: {
    platform: string;
    customer_first_name: string;
    items: Array<{ menu_item_name: string; quantity: number; modifiers: { modifier_name: string }[]; special_instructions: string | null }>;
    allergies: string[];
    dietary: string[];
    kitchen_note?: string | null;
  };
}

export default function KitchenDisplay() {
  const { data: tickets = [], isLoading } = useQuery<KitchenTicket[]>({
    queryKey: ["toast", "tickets"],
    queryFn: () => api("/toast/orders"),
    refetchInterval: 4000,
  });

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-slate-700">
        <ChefHat size={22} /> Kitchen display
      </h2>
      {isLoading ? (
        <div className="text-slate-500">Loading…</div>
      ) : tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No tickets yet. Send an order from the review screen to fire one.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {tickets.map((t) => (
            <div key={t.toast_order_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-sm font-mono text-slate-400">{t.toast_order_id}</div>
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock size={12} />
                  {t.fired_at ? new Date(t.fired_at).toLocaleTimeString() : ""}
                </div>
              </div>
              <div className="mt-1 text-base font-bold">
                {t.payload.customer_first_name ?? "Customer"}
                <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs uppercase text-slate-500">{t.payload.platform}</span>
              </div>
              {(t.payload.allergies?.length || 0) > 0 && (
                <div className="mt-1 rounded bg-danger-500/10 px-2 py-1 text-sm font-bold text-danger-600">
                  ⚠ Allergy: {t.payload.allergies.join(", ")}
                </div>
              )}
              {t.payload.kitchen_note && (
                <div className="mt-1 rounded border-l-4 border-warn-500 bg-warn-500/10 px-2 py-1 text-sm italic text-slate-700">
                  <span className="text-xs font-bold uppercase text-warn-500">Note: </span>
                  “{t.payload.kitchen_note}”
                </div>
              )}
              <ul className="mt-2 space-y-1 text-sm">
                {t.payload.items?.map((it, i) => (
                  <li key={i} className="border-l-4 border-bridge-500 pl-2">
                    <div className="font-semibold">{it.quantity}× {it.menu_item_name}</div>
                    {it.modifiers?.length ? (
                      <div className="text-xs text-slate-600">
                        {it.modifiers.map((m) => m.modifier_name).join(" · ")}
                      </div>
                    ) : null}
                    {it.special_instructions && (
                      <div className="text-xs italic text-slate-500">“{it.special_instructions}”</div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
