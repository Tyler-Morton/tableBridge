import { ConfidenceTag } from "./ConfidenceTag";
import type { MappedItem } from "@/types";
import { Trash2 } from "lucide-react";

interface Props {
  item: MappedItem;
  onChange: (next: MappedItem) => void;
  onRemove: () => void;
  threshold?: number;
}

export function EditableItem({ item, onChange, onRemove, threshold }: Props) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow duration-150 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) || 1 })}
              className="w-12 rounded border border-slate-200 px-1 py-0.5 text-center text-sm
                         transition-colors duration-150"
            />
            <span className="text-slate-300">×</span>
            <input
              value={item.menu_item_name}
              onChange={(e) => onChange({ ...item, menu_item_name: e.target.value })}
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm font-semibold
                         transition-colors duration-150"
            />
          </div>
          {item.menu_item_id && (
            <div className="mt-1 text-xs text-slate-400">Toast item #{item.menu_item_id}</div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceTag confidence={item.confidence} threshold={threshold} />
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-slate-300 transition-all duration-150
                       hover:bg-red-50 hover:text-red-500
                       active:scale-[0.90]"
            aria-label="Remove item"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {item.modifiers.length > 0 && (
        <div className="mt-2 space-y-1">
          {item.modifiers.map((m, idx) => (
            <div key={idx} className="flex items-center gap-2 text-sm text-slate-600">
              <span className="text-slate-300">·</span>
              <input
                value={m.modifier_name}
                onChange={(e) => {
                  const next = [...item.modifiers];
                  next[idx] = { ...m, modifier_name: e.target.value };
                  onChange({ ...item, modifiers: next });
                }}
                className="flex-1 rounded border border-slate-200 px-2 py-0.5 text-sm
                           transition-colors duration-150"
              />
              <ConfidenceTag confidence={m.confidence} threshold={threshold} />
            </div>
          ))}
        </div>
      )}

      {item.special_instructions && (
        <div className="mt-2 rounded bg-slate-50 px-2 py-1.5 text-xs italic text-slate-500">
          "{item.special_instructions}"
        </div>
      )}
    </div>
  );
}
