import { AlertTriangle, Leaf } from "lucide-react";

interface Props { allergies?: string[]; dietary?: string[] }

export function AllergyBanner({ allergies = [], dietary = [] }: Props) {
  if (!allergies.length && !dietary.length) return null;
  return (
    <div className="space-y-2">
      {allergies.length > 0 && (
        <div className="animate-enter flex items-start gap-3 rounded-lg border border-danger-500/30 bg-danger-500/8 px-4 py-3 shadow-sm shadow-danger-500/10 ring-1 ring-danger-500/20">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-danger-500 text-white shadow-sm">
            <AlertTriangle size={14} strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-danger-600">
              Allergy alert
            </div>
            <div className="mt-0.5 text-sm font-semibold capitalize text-danger-700">
              {allergies.join(", ")}
            </div>
          </div>
        </div>
      )}
      {dietary.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warn-500/30 bg-warn-500/8 px-3 py-2.5">
          <Leaf size={16} className="shrink-0 text-warn-500" />
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-warn-500">Dietary</div>
            <div className="text-sm font-medium text-amber-800">{dietary.join(", ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
