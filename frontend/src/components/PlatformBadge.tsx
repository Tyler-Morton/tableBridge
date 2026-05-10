import type { Platform } from "@/types";

const STYLES: Record<Platform, string> = {
  doordash: "bg-red-100 text-red-700",
  ubereats: "bg-emerald-100 text-emerald-800",
  grubhub: "bg-orange-100 text-orange-700",
};

const LABELS: Record<Platform, string> = {
  doordash: "DoorDash",
  ubereats: "Uber Eats",
  grubhub: "Grubhub",
};

export function PlatformBadge({ platform }: { platform: Platform | string }) {
  const p = platform as Platform;
  const cls = STYLES[p] ?? "bg-slate-100 text-slate-700";
  const label = LABELS[p] ?? platform;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}
