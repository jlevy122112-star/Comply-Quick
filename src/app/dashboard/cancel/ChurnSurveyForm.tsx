"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CHURN_REASONS, CHURN_REASON_LABELS, type ChurnReason } from "@/lib/pmf/metrics";
import { trackClientEvent } from "@/lib/funnel/client";
import { isChurnSaveOfferEnabled } from "@/lib/optimizations/flags";

/**
 * Cancellation exit survey ([Up11]). Captures the churn reason before sending
 * the user to Stripe's billing portal to actually cancel. Submitting is
 * optional — "Skip" goes straight to the portal.
 */
export default function ChurnSurveyForm() {
  const [reason, setReason] = useState<ChurnReason | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const showSaveOffer = isChurnSaveOfferEnabled();

  useEffect(() => {
    if (showSaveOffer) {
      trackClientEvent("churn_save_offer_shown", { surface: "cancel_page", offer: "pricing" });
    }
  }, [showSaveOffer]);

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
        body: JSON.stringify({ reason, comment, channel: readChannel(), outcome: "proceed_to_cancel" }),
      });
    } catch {
      /* still continue to portal even if the survey fails */
    }
    await openPortal();
  }

  return (
    <div className="space-y-4">
      {showSaveOffer ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-300">Before you cancel: compare lower-cost options</p>
          <p className="mt-1 text-xs text-gray-300">
            Many teams switch plans instead of canceling. Review the Solo and annual options before ending access.
          </p>
          <Link
            href="/#pricing"
            onClick={() => trackClientEvent("churn_save_offer_accepted", { surface: "cancel_page", offer: "pricing" })}
            className="mt-3 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            Compare lower-cost plans
          </Link>
        </div>
      ) : null}
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
