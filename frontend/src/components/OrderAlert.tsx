import { useNavigate } from "react-router-dom";
import { useOrderStore } from "@/stores/orderStore";
import { useAudio } from "@/hooks/useAudio";
import { PlatformBadge } from "./PlatformBadge";
import { AlertTriangle } from "lucide-react";

/**
 * Top-of-screen banner that appears when there are pending order alerts.
 * Beep continues until the user taps "Review Order".
 */
export function OrderAlert() {
  const alerts = useOrderStore((s) => s.pendingAlerts);
  const dismiss = useOrderStore((s) => s.dismissAlert);
  const { stop } = useAudio();
  const navigate = useNavigate();
  if (!alerts.length) return null;
  const top = alerts[0];

  const handleReview = () => {
    stop();
    dismiss(top.raw_id);
    navigate(`/review/${top.raw_id}`);
  };

  return (
    <div className="fixed left-1/2 top-3 z-50 w-[640px] -translate-x-1/2 animate-slide-in">
      <div className="flex items-center gap-3 rounded-xl border-4 border-danger-500 bg-white p-4 shadow-2xl animate-alert-pulse">
        <div className="rounded-full bg-danger-500 p-2 text-white">
          <AlertTriangle size={26} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={top.platform} />
            {top.has_allergies && (
              <span className="rounded bg-danger-500 px-2 py-0.5 text-xs font-bold text-white">
                ALLERGY
              </span>
            )}
          </div>
          <div className="mt-1 text-base font-semibold text-slate-800">
            New order — {top.customer_display_name} · {top.item_count} items
          </div>
          <div className="text-xs text-slate-500">
            AI confidence {Math.round(top.overall_confidence * 100)}%
            {alerts.length > 1 ? ` · ${alerts.length - 1} more queued` : ""}
          </div>
        </div>
        <button
          onClick={handleReview}
          className="rounded-lg bg-danger-500 px-5 py-3 text-base font-bold text-white shadow hover:bg-danger-600 active:scale-[0.98]"
        >
          Review Order
        </button>
      </div>
    </div>
  );
}
