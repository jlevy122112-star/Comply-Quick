"use client";

import { useState } from "react";
import { CHURN_REASONS, CHURN_REASON_LABELS, type ChurnReason } from "@/lib/pmf/metrics";

/**
 * Cancellation exit survey ([Up11]). Captures the churn reason before sending
 * the user to Stripe's billing portal to actually cancel. Submitting is
 * optional — "Skip" goes straight to the portal.
 */
export default function ChurnSurveyForm() {
  const [reason, setReason] = useState<ChurnReason | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  function readChannel(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const m = document.cookie.match(/(?:^|;\s*)cq_channel=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : undefined;
  }

  async function openPortal() {
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      /* no-op; user can retry */
    }
  }

  async function submitAndContinue() {
    if (!reason) return;
    setBusy(true);
    try {
      await fetch("/api/pmf/churn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment, channel: readChannel() }),
      });
    } catch {
      /* still continue to portal even if the survey fails */
    }
    await openPortal();
  }

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        {CHURN_REASONS.map((r) => (
          <label
            key={r}
            className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
              reason === r ? "border-indigo-500 bg-indigo-500/10 text-white" : "border-gray-700 text-gray-300"
            }`}
          >
            <input
              type="radio"
              name="reason"
              value={r}
              checked={reason === r}
              onChange={() => setReason(r)}
              className="accent-indigo-500"
            />
            {CHURN_REASON_LABELS[r]}
          </label>
        ))}
      </fieldset>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything we could have done better? (optional)"
        rows={3}
        className="w-full rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
      />

      <div className="flex items-center gap-3">
        <button
          onClick={submitAndContinue}
          disabled={!reason || busy}
          className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? "…" : "Submit & manage plan"}
        </button>
        <button onClick={openPortal} className="text-sm text-gray-400 hover:text-gray-200">
          Skip
        </button>
      </div>
    </div>
  );
}
