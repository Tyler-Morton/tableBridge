import { AlertTriangle, Leaf } from "lucide-react";

interface Props { allergies?: string[]; dietary?: string[] }

export function AllergyBanner({ allergies = [], dietary = [] }: Props) {
  if (!allergies.length && !dietary.length) return null;
  return (
    <div className="space-y-2">
      {allergies.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border-2 border-danger-500 bg-danger-500/10 px-4 py-3 text-danger-600">
          <AlertTriangle size={22} />
          <div>
            <div className="text-sm font-bold uppercase tracking-wide">Allergy alert</div>
            <div className="text-base font-semibold">{allergies.join(", ")}</div>
          </div>
        </div>
      )}
      {dietary.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-warn-500 bg-warn-500/10 px-3 py-2 text-warn-500">
          <Leaf size={18} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wide">Dietary</div>
            <div className="text-sm font-medium">{dietary.join(", ")}</div>
          </div>
        </div>
      )}
    </div>
  );
}
