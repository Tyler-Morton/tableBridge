import type { OrderDetail, MappedItem } from "@/types";
import { PlatformBadge } from "./PlatformBadge";
import { EditableItem } from "./EditableItem";
import { AllergyBanner } from "./AllergyBanner";
import { Clock } from "lucide-react";

interface Props {
  order: OrderDetail;
  edited: OrderDetail["parsed"];
  onChange: (next: OrderDetail["parsed"]) => void;
}

export function SideBySidePanel({ order, edited, onChange }: Props) {
  const updateItem = (idx: number, item: MappedItem) => {
    const next = [...edited.mapped_items];
    next[idx] = item;
    onChange({ ...edited, mapped_items: next });
  };
  const removeItem = (idx: number) => {
    onChange({
      ...edited,
      mapped_items: edited.mapped_items.filter((_, i) => i !== idx),
    });
  };

  // Best-effort raw-line list
  const rawLines = extractRawLines(order.raw);

  return (
    <div className="grid h-full grid-cols-2 gap-4">
      {/* LEFT — raw order from platform (read-only) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-700">As ordered</h3>
          <PlatformBadge platform={order.platform} />
        </div>
        <div className="mb-3 space-y-1 text-sm text-slate-600">
          <div><span className="font-semibold">Customer:</span> {order.customer_display_name}</div>
          {order.pickup_time && (
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>Pickup: {new Date(order.pickup_time).toLocaleTimeString()}</span>
            </div>
          )}
          <div className="text-xs text-slate-400">Order ID: {order.external_order_id}</div>
        </div>

        <div className="space-y-2">
          {rawLines.map((line, i) => (
            <div key={i} className="rounded border border-slate-200 bg-white p-3 text-sm">
              <div className="font-semibold text-slate-800">
                {line.quantity}× {line.name}
              </div>
              {line.modifiers.length > 0 && (
                <ul className="ml-3 mt-1 list-disc text-slate-600">
                  {line.modifiers.map((m, j) => (<li key={j}>{m}</li>))}
                </ul>
              )}
              {line.note && (
                <div className="mt-1 italic text-slate-500">“{line.note}”</div>
              )}
            </div>
          ))}
        </div>

        {extractOrderNote(order.raw) && (
          <div className="mt-3 rounded border-l-4 border-warn-500 bg-warn-500/10 px-3 py-2 text-sm italic text-slate-700">
            <div className="text-xs font-bold uppercase text-warn-500">Order note</div>
            <div>“{extractOrderNote(order.raw)}”</div>
          </div>
        )}
      </div>

      {/* RIGHT — AI-parsed Toast format (editable) */}
      <div className="rounded-xl border border-bridge-100 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-bridge-700">Toast-ready</h3>
        <div className="mb-3">
          <AllergyBanner
            allergies={edited.detected_allergies}
            dietary={edited.detected_dietary}
          />
        </div>
        {edited.unmappable_notes.length > 0 && (
          <div className="mb-3 rounded border border-orange-300 bg-orange-50 p-2 text-sm text-orange-700">
            <div className="font-semibold">Unmappable items</div>
            <ul className="ml-4 list-disc">
              {edited.unmappable_notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}
        <div className="space-y-2">
          {edited.mapped_items.map((it, i) => (
            <EditableItem
              key={i}
              item={it}
              onChange={(next) => updateItem(i, next)}
              onRemove={() => removeItem(i)}
            />
          ))}
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-bridge-700">
            Kitchen note (rides with the ticket)
          </label>
          <textarea
            value={edited.kitchen_note ?? ""}
            onChange={(e) => onChange({ ...edited, kitchen_note: e.target.value || null })}
            rows={2}
            placeholder="e.g. EXTRA hot sauce · cut sandwich in half · on the side: ranch"
            className="w-full rounded-lg border border-bridge-100 bg-bridge-50 px-3 py-2 text-sm focus:border-bridge-500 focus:outline-none"
          />
          <div className="mt-1 text-xs text-slate-500">
            Auto-filled from the order/delivery note. Edit before sending if needed — this fires to the kitchen ticket as-is.
          </div>
        </div>
      </div>
    </div>
  );
}

function extractRawLines(raw: Record<string, unknown>): { name: string; quantity: number; modifiers: string[]; note: string | null }[] {
  // Handles all three platform schemas
  const items = (raw.items || raw.lines || (raw.cart as any)?.items || []) as any[];
  return items.map((it) => {
    const name = it.name ?? it.title ?? "Unknown item";
    const quantity = it.quantity ?? 1;
    const modifiers: string[] = [];
    if (Array.isArray(it.modifiers)) modifiers.push(...it.modifiers.map((m: any) => m.name));
    if (Array.isArray(it.options)) modifiers.push(...it.options.map((o: any) => o.name));
    if (Array.isArray(it.selected_modifier_groups)) {
      for (const g of it.selected_modifier_groups) {
        for (const sel of g.selected_items ?? []) modifiers.push(sel.title);
      }
    }
    return {
      name,
      quantity,
      modifiers,
      note: it.special_instructions ?? null,
    };
  });
}

function extractOrderNote(raw: Record<string, unknown>): string | null {
  return (raw.special_instructions as string)
    ?? (raw.customer_note as string)
    ?? (raw.instructions as string)
    ?? null;
}
