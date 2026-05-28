import { useState, useRef, useEffect } from "react";
import type { OrderDetail, MappedItem } from "@/types";
import { PlatformBadge } from "./PlatformBadge";
import { EditableItem } from "./EditableItem";
import { Clock, AlertTriangle, Leaf, Plus, X } from "lucide-react";

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
    onChange({ ...edited, mapped_items: edited.mapped_items.filter((_, i) => i !== idx) });
  };

  const rawLines = extractRawLines(order.raw);
  const orderNote = extractOrderNote(order.raw);

  return (
    <div className="grid h-full grid-cols-2 gap-4">
      {/* LEFT — raw order from platform (read-only) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">As ordered</h3>
          <PlatformBadge platform={order.platform} />
        </div>

        <div className="mb-4 space-y-1 text-sm">
          <div className="font-semibold text-slate-800">{order.customer_display_name}</div>
          {order.pickup_time && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock size={12} />
              Pickup {new Date(order.pickup_time).toLocaleTimeString()}
            </div>
          )}
          <div className="text-xs text-slate-400">#{order.external_order_id}</div>
        </div>

        <div className="space-y-2">
          {rawLines.map((line, i) => (
            <div key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
              <div className="font-semibold text-slate-800">
                {line.quantity}× {line.name}
              </div>
              {line.modifiers.length > 0 && (
                <ul className="ml-3 mt-1 space-y-0.5 text-xs text-slate-500">
                  {line.modifiers.map((m, j) => (
                    <li key={j} className="flex items-center gap-1">
                      <span className="text-slate-300">·</span> {m}
                    </li>
                  ))}
                </ul>
              )}
              {line.note && (
                <div className="mt-1.5 text-xs italic text-slate-400">"{line.note}"</div>
              )}
            </div>
          ))}
        </div>

        {orderNote && (
          <div className="mt-3 rounded-lg border-l-4 border-warn-500 bg-warn-500/8 px-3 py-2.5 text-sm">
            <div className="mb-0.5 text-xs font-bold uppercase tracking-wide text-warn-500">
              Order note
            </div>
            <div className="italic text-slate-600">"{orderNote}"</div>
          </div>
        )}
      </div>

      {/* RIGHT — AI-parsed Toast format (editable) */}
      <div className="rounded-xl border border-bridge-100 bg-white p-4">
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-bridge-600">
          Toast-ready
        </h3>

        {/* Editable allergy + dietary */}
        <EditableAllergySection
          allergies={edited.detected_allergies}
          dietary={edited.detected_dietary}
          onChangeAllergies={(next) => onChange({ ...edited, detected_allergies: next })}
          onChangeDietary={(next) => onChange({ ...edited, detected_dietary: next })}
        />

        {edited.unmappable_notes.length > 0 && (
          <div className="mb-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-700">
            <div className="mb-1 font-semibold">Unmappable items</div>
            <ul className="ml-4 list-disc space-y-0.5 text-xs">
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
          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-bridge-600">
            Kitchen note
          </label>
          <textarea
            value={edited.kitchen_note ?? ""}
            onChange={(e) => onChange({ ...edited, kitchen_note: e.target.value || null })}
            rows={2}
            placeholder="e.g. extra hot sauce · cut in half · ranch on the side"
            className="w-full rounded-lg border border-bridge-100 bg-bridge-50/60 px-3 py-2 text-sm
                       transition-colors duration-150 focus:bg-white"
          />
          <div className="mt-1 text-xs text-slate-400">
            Auto-filled from the delivery note. Fires to the kitchen ticket as-is.
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editable allergy + dietary section
// ---------------------------------------------------------------------------

interface EditableAllergyProps {
  allergies: string[];
  dietary: string[];
  onChangeAllergies: (next: string[]) => void;
  onChangeDietary: (next: string[]) => void;
}

function EditableAllergySection({
  allergies,
  dietary,
  onChangeAllergies,
  onChangeDietary,
}: EditableAllergyProps) {
  const hasAny = allergies.length > 0 || dietary.length > 0;

  return (
    <div className={`mb-3 space-y-2 ${hasAny ? "" : "mb-0"}`}>
      {/* Allergy block */}
      <EditableTagGroup
        tags={allergies}
        onChange={onChangeAllergies}
        variant="allergy"
        icon={<AlertTriangle size={13} strokeWidth={2.5} />}
        label="Allergy alert"
        placeholder="e.g. onions"
        addLabel="Add allergy"
        emptyLabel="No allergies flagged"
      />

      {/* Dietary block */}
      <EditableTagGroup
        tags={dietary}
        onChange={onChangeDietary}
        variant="dietary"
        icon={<Leaf size={13} />}
        label="Dietary"
        placeholder="e.g. vegan"
        addLabel="Add dietary flag"
        emptyLabel={null}
      />

      {/* Scope hint — appears when dietary flags exist */}
      {dietary.length > 0 && (
        <p className="text-xs text-slate-400">
          Dietary flags from item notes may apply to that item only — remove if it doesn't
          apply to the full order.
        </p>
      )}
    </div>
  );
}

interface EditableTagGroupProps {
  tags: string[];
  onChange: (next: string[]) => void;
  variant: "allergy" | "dietary";
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  addLabel: string;
  emptyLabel: string | null;
}

function EditableTagGroup({
  tags,
  onChange,
  variant,
  icon,
  label,
  placeholder,
  addLabel,
  emptyLabel,
}: EditableTagGroupProps) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commit = () => {
    const val = input.trim().toLowerCase();
    if (val && !tags.includes(val)) {
      onChange([...tags, val]);
    }
    setInput("");
    setAdding(false);
  };

  const remove = (i: number) => onChange(tags.filter((_, j) => j !== i));

  const isAllergy = variant === "allergy";
  const containerCls = isAllergy
    ? "rounded-lg border border-danger-500/25 bg-danger-500/8 px-3 py-2.5"
    : "rounded-lg border border-warn-500/25 bg-warn-500/8 px-3 py-2.5";
  const labelCls = isAllergy ? "text-danger-600" : "text-warn-500";
  const chipBg = isAllergy
    ? "bg-danger-500/15 text-danger-700 hover:bg-danger-500/25"
    : "bg-warn-500/15 text-amber-800 hover:bg-warn-500/25";
  const addBtnCls = isAllergy
    ? "text-danger-500 hover:text-danger-700"
    : "text-warn-500 hover:text-amber-700";

  // If no tags and no emptyLabel, render only an "add" button
  if (tags.length === 0 && !emptyLabel) {
    return (
      <div className="flex items-center gap-1">
        {adding ? (
          <AddInput
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onCommit={commit}
            onCancel={() => { setInput(""); setAdding(false); }}
            placeholder={placeholder}
            variant={variant}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`flex items-center gap-1 text-xs font-medium transition-colors duration-100 ${addBtnCls}`}
          >
            <Plus size={12} /> {addLabel}
          </button>
        )}
      </div>
    );
  }

  if (tags.length === 0 && emptyLabel) {
    return (
      <div className="flex items-center gap-2">
        {adding ? (
          <AddInput
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onCommit={commit}
            onCancel={() => { setInput(""); setAdding(false); }}
            placeholder={placeholder}
            variant={variant}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`flex items-center gap-1 text-xs font-medium transition-colors duration-100 ${addBtnCls}`}
          >
            <Plus size={12} /> {addLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={containerCls}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <div className={`flex h-5 w-5 items-center justify-center rounded-full ${isAllergy ? "bg-danger-500" : "bg-warn-500"} text-white`}>
          {icon}
        </div>
        <span className={`text-xs font-bold uppercase tracking-widest ${labelCls}`}>{label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {tags.map((tag, i) => (
          <span
            key={i}
            className={`animate-enter flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize transition-colors duration-100 ${chipBg}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => remove(i)}
              className="ml-0.5 opacity-60 transition-opacity hover:opacity-100 active:scale-90"
              aria-label={`Remove ${tag}`}
            >
              <X size={10} strokeWidth={2.5} />
            </button>
          </span>
        ))}

        {adding ? (
          <AddInput
            inputRef={inputRef}
            value={input}
            onChange={setInput}
            onCommit={commit}
            onCancel={() => { setInput(""); setAdding(false); }}
            placeholder={placeholder}
            variant={variant}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-100 ${addBtnCls}`}
          >
            <Plus size={11} /> Add
          </button>
        )}
      </div>
    </div>
  );
}

function AddInput({
  inputRef,
  value,
  onChange,
  onCommit,
  onCancel,
  placeholder,
  variant,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  value: string;
  onChange: (v: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  placeholder: string;
  variant: "allergy" | "dietary";
}) {
  const borderCls = variant === "allergy"
    ? "border-danger-300 focus:border-danger-500"
    : "border-warn-300 focus:border-warn-500";

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onCommit(); }}
      className="flex items-center gap-1"
    >
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-28 rounded-full border bg-white px-2.5 py-0.5 text-xs outline-none transition-colors ${borderCls}`}
        onKeyDown={(e) => { if (e.key === "Escape") onCancel(); }}
      />
      <button
        type="submit"
        className="text-xs font-semibold text-slate-600 hover:text-slate-800"
      >
        Add
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Raw order extraction helpers
// ---------------------------------------------------------------------------

function extractRawLines(raw: Record<string, unknown>): {
  name: string;
  quantity: number;
  modifiers: string[];
  note: string | null;
}[] {
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
    return { name, quantity, modifiers, note: it.special_instructions ?? null };
  });
}

function extractOrderNote(raw: Record<string, unknown>): string | null {
  return (
    (raw.special_instructions as string) ??
    (raw.customer_note as string) ??
    (raw.instructions as string) ??
    null
  );
}
