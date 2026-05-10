interface Props { confidence: number; threshold?: number }

export function ConfidenceTag({ confidence, threshold = 0.85 }: Props) {
  const pct = Math.round(confidence * 100);
  const low = confidence < threshold;
  const cls = low
    ? "bg-orange-100 text-orange-700 border border-orange-300"
    : "bg-emerald-100 text-emerald-800 border border-emerald-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {low ? "Review" : "OK"} · {pct}%
    </span>
  );
}
