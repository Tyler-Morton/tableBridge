import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { OrderDetail, ParsedOrder, ReviewAction } from "@/types";
import { SideBySidePanel } from "@/components/SideBySidePanel";
import { Send, Flag, X, ArrowLeft } from "lucide-react";

export default function ReviewOrder() {
  const { rawId } = useParams<{ rawId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery<OrderDetail>({
    queryKey: ["order", rawId],
    queryFn: () => api(`/orders/${rawId}`),
    enabled: !!rawId,
    refetchInterval: (q) => (q.state.data ? false : 1500), // poll while AI parses
  });

  const [edited, setEdited] = useState<ParsedOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  // Reset edited state whenever the URL changes (user clicked a new alert
  // while already on a review screen).
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
      <div className="rounded-xl bg-white p-8 text-center text-slate-500">
        <div className="mb-2 text-lg font-semibold">Parsing order with AI…</div>
        <div className="text-sm">This usually takes a couple of seconds.</div>
      </div>
    );
  }
  if (error) {
    return <div className="rounded-xl bg-danger-500/10 p-6 text-danger-600">Failed to load order.</div>;
  }

  const isAlreadyReviewed = data.status !== "pending_review";

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-xs text-slate-500">
          Status: <span className="font-bold uppercase">{data.status}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <SideBySidePanel order={data} edited={edited} onChange={setEdited} />
      </div>

      {!isAlreadyReviewed && (
        <div className="grid grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-md">
          <button
            onClick={() => review.mutate({ action: "send" })}
            disabled={review.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-good-500 py-4 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Send size={20} /> Send to Kitchen
          </button>
          <button
            onClick={() => review.mutate({ action: "flag" })}
            disabled={review.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-warn-500 py-4 text-lg font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            <Flag size={20} /> Flag for Manager
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={review.isPending}
            className="flex items-center justify-center gap-2 rounded-lg bg-danger-500 py-4 text-lg font-bold text-white hover:bg-danger-600 disabled:opacity-50"
          >
            <X size={20} /> Reject Order
          </button>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold">Reject order</h3>
            <p className="mb-3 text-sm text-slate-500">
              This will not be sent to the kitchen. Tell us why.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              className="mb-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
              placeholder="Reason (e.g. item out of stock, customer cancelled)"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowReject(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
              >Cancel</button>
              <button
                onClick={() => review.mutate({ action: "reject", notes: rejectReason })}
                disabled={!rejectReason.trim()}
                className="rounded-lg bg-danger-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
