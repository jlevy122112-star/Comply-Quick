"use client";

import { useId, useState } from "react";
import { FOUNDING_COUPON_REWARD } from "@/lib/promo";

type Status = "idle" | "submitting" | "success" | "error";

interface LeadResponse {
  ok?: boolean;
  founding?: boolean;
  couponCode?: string;
}

interface ClaimResponse {
  ok?: boolean;
  token?: string;
  error?: string;
}

/** Reads first-touch UTM params from the current URL, if present. */
function readUtm(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = params.get(key);
    if (value) out[key] = value;
  }
  return out;
}

export function LeadCaptureForm({ source = "landing_hero" }: { source?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [result, setResult] = useState<LeadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    setError(null);
    try {
      const claimRes = await fetch("/api/free-scan/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source }),
      });
      const claimData: ClaimResponse = await claimRes.json().catch(() => ({}));
      if (!claimRes.ok || !claimData.token) {
        setError(
          claimData.error === "already_used"
            ? "That email has already used its one-time free scan. Start a workspace for ongoing scans."
            : "Could not claim your free scan. Please try again."
        );
        setStatus("error");
        return;
      }

      setClaimToken(claimData.token);
      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source, ...readUtm() }),
      });
      const leadData: LeadResponse = await leadRes.json().catch(() => ({}));
      if (!leadRes.ok || !leadData.ok) {
        setStatus("error");
        setError("Could not complete signup right now. Please try again.");
        return;
      }
      setResult(leadData);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Something went wrong. Please check your email and try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="w-full max-w-md mx-auto rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
        <p className="text-base font-semibold text-white">You&apos;re in. Your free scan is ready.</p>
        <p className="mt-2 text-sm text-gray-300">
          {result?.founding
            ? `As a Founding 100 member you've unlocked ${FOUNDING_COUPON_REWARD} — your code is in the email${
                result.couponCode ? ` (${result.couponCode})` : ""
              }.`
            : "We sent follow-up details by email."}
        </p>
        {claimToken && (
          <a
            href={`/free-scan?token=${encodeURIComponent(claimToken)}`}
            className="mt-4 inline-flex rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Run free scan
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <label htmlFor={inputId} className="sr-only">
          Work email
        </label>
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="flex-1 min-w-0 px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {status === "submitting" ? "Sending…" : "Get My Free Scan"}
        </button>
      </div>
      {status === "error" && error && (
        <div className="mt-2 space-y-2" role="alert">
          <p className="text-sm text-red-400">{error}</p>
          {claimToken && (
            <a
              href={`/free-scan?token=${encodeURIComponent(claimToken)}`}
              className="text-xs text-indigo-300 underline"
            >
              Continue to free scan
            </a>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-gray-400">
        Join the Founding 100 &mdash; free premium scan for our first 100 members. No credit card required.
      </p>
    </form>
  );
}
