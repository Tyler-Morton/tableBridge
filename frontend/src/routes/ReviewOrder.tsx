import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { OrderDetail, ParsedOrder, ReviewAction } from "@/types";
import { SideBySidePanel } from "@/components/SideBySidePanel";
import { Send, Flag, X, ArrowLeft, Loader2 } from "lucide-react";

export default function ReviewOrder() {
  const { rawId } = useParams<{ rawId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ["order", rawId],
    queryFn: () => api(`/orders/${rawId}`),
    enabled: !!rawId,
    refetchInterval: (q) => (q.state.data ? false : 1500),
  });

  const [edited, setEdited] = useState<ParsedOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  useEffect(() => {
    setEdited(null);
    setShowReject(false);
    setRejectReason("");
  }, [rawId]);

  useEffect(() => {
    if (data && !edited) setEdited(data.parsed);
  }, [data, edited]);

  const review = useMutation({
    mutationFn: (vars: { action: ReviewAction; notes?: string }) =>
      api("/reviews", {
        method: "POST",
        body: JSON.stringify({
          parsed_id: data!.parsed_id,
          action: vars.action,
          edits: edited,
          notes: vars.notes ?? null,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders", "recent"] });
      navigate("/dashboard");
    },
  });

  if (isLoading || !data || !edited) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl bg-white py-16 text-center shadow-sm ring-1 ring-slate-200/60">
        <Loader2 size={28} className="mb-3 animate-spin text-bridge-500" />
        <div className="text-base font-semibold text-slate-700">Parsing order with AI…</div>
        <div className="mt-1 text-sm text-slate-400">Usually takes a couple of seconds.</div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl bg-danger-500/10 p-6 text-danger-600 ring-1 ring-danger-500/20">
        Failed to load order.
      </div>
    );
  }

  const isAlreadyReviewed = data.status !== "pending_review";

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-500
                     transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700
                     active:scale-[0.97]"
        >
          <ArrowLeft size={15} /> Back
        </button>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {data.status.replace("_", " ")}
        </div>
      </div>

      {/* Main panel */}
      <div className="min-h-0 flex-1 overflow-auto">
        <SideBySidePanel order={data} edited={edited} onChange={setEdited} />
      </div>

      {/* Action bar */}
      {!isAlreadyReviewed && (
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-md">
          <button
            onClick={() => review.mutate({ action: "send" })}
            disabled={review.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-good-500 py-4 text-base font-bold text-white shadow-sm
                       transition-all duration-150 hover:bg-emerald-700
                       active:scale-[0.97] active:shadow-none
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={18} /> Send to Kitchen
          </button>
          <button
            onClick={() => review.mutate({ action: "flag" })}
            disabled={review.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-warn-500 py-4 text-base font-bold text-white shadow-sm
                       transition-all duration-150 hover:bg-orange-600
                       active:scale-[0.97] active:shadow-none
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Flag size={18} /> Flag for Manager
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={review.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-danger-500 py-4 text-base font-bold text-white shadow-sm
                       transition-all duration-150 hover:bg-danger-600
                       active:scale-[0.97] active:shadow-none
                       disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={18} /> Reject Order
          </button>
        </div>
      )}

      {/* Reject modal — animated in */}
      {showReject && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 animate-fade-in sm:items-center"
          onClick={(e) => { if (e.target === e.currentTarget) setShowReject(false); }}
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl animate-modal-enter">
            <h3 className="text-lg font-bold text-slate-800">Reject order</h3>
            <p className="mb-4 mt-1 text-sm text-slate-500">
              This will not be sent to the kitchen. Tell us why.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              autoFocus
              className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm
                         transition-colors duration-150 focus:bg-white"
              placeholder="Reason (e.g. item out of stock, customer cancelled)"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReject(false)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600
                           transition-colors duration-150 hover:bg-slate-50
                           active:scale-[0.97]"
              >
                Cancel
              </button>
              <button
                onClick={() => review.mutate({ action: "reject", notes: rejectReason })}
                disabled={!rejectReason.trim()}
                className="rounded-lg bg-danger-500 px-4 py-2.5 text-sm font-semibold text-white
                           transition-all duration-150 hover:bg-danger-600
                           active:scale-[0.97]
                           disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
