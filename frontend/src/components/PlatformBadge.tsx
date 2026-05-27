import type { Platform } from "@/types";

const CONFIG: Record<Platform, { label: string; bg: string; text: string; dot: string }> = {
  doordash: { label: "DoorDash", bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" },
  ubereats: { label: "Uber Eats", bg: "bg-emerald-50", text: "text-emerald-800", dot: "bg-emerald-500" },
  grubhub: { label: "Grubhub", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" },
};

export function PlatformBadge({ platform }: { platform: Platform | string }) {
  const cfg = CONFIG[platform as Platform];
  if (!cfg) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        {platform}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
