import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useOrderStore } from "@/stores/orderStore";
import { useAudio } from "@/hooks/useAudio";
import { PlatformBadge } from "./PlatformBadge";
import { AlertTriangle } from "lucide-react";

/**
 * Top-of-screen banner that appears when there are pending order alerts.
 * Springs in, beeps until acknowledged, and animates out cleanly on dismiss.
 */
export function OrderAlert() {
  const alerts = useOrderStore((s) => s.pendingAlerts);
  const dismiss = useOrderStore((s) => s.dismissAlert);
  const { stop } = useAudio();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const top = alerts[0];

  const handleReview = () => {
    stop();
    dismiss(top.raw_id);
    navigate(`/review/${top.raw_id}`);
  };

  return (
    <div className="pointer-events-none fixed left-1/2 top-3 z-50 w-[640px] max-w-[calc(100vw-1.5rem)] -translate-x-1/2">
      <AnimatePresence mode="popLayout">
        {top && (
          <motion.div
            key={top.raw_id}
            layout
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 30 }}
            className="pointer-events-auto"
          >
            <div className="flex items-center gap-3 rounded-xl border-2 border-danger-500 bg-white p-4 shadow-2xl shadow-danger-500/20 animate-alert-pulse">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger-500 text-white">
                <AlertTriangle size={22} strokeWidth={2.5} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={top.platform} />
                  {top.has_allergies && (
                    <span className="rounded-full bg-danger-500 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                      Allergy
                    </span>
                  )}
                </div>
                <div className="mt-1 truncate text-base font-semibold text-slate-800">
                  New order — {top.customer_display_name} · {top.item_count} items
                </div>
                <div className="text-xs text-slate-500">
                  AI confidence {Math.round(top.overall_confidence * 100)}%
                  {alerts.length > 1 ? ` · ${alerts.length - 1} more queued` : ""}
                </div>
              </div>
              <motion.button
                onClick={handleReview}
                whileTap={reduce ? undefined : { scale: 0.96 }}
                className="shrink-0 rounded-lg bg-danger-500 px-5 py-3 text-base font-bold text-white shadow-sm transition-colors duration-150 hover:bg-danger-600"
              >
                Review Order
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
