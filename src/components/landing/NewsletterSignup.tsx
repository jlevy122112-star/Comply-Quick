"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Compact newsletter opt-in for the footer. Posts to the shared /api/leads
 * endpoint with a newsletter source tag, so subscribers land in the same
 * private email list as landing-page leads.
 */
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "newsletter_footer" }),
      });
      const data = await res.json().catch(() => ({}));
      setStatus(res.ok && data.ok ? "success" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return <p className="text-sm text-emerald-400">Subscribed — watch your inbox for compliance updates.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <label htmlFor="newsletter-email" className="block text-sm font-medium text-white">
        Compliance newsletter
      </label>
      <p className="mt-1 text-xs text-gray-300">
        Regulatory changes and product updates. No spam, unsubscribe anytime.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={status === "submitting"}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          {status === "submitting" ? "…" : "Subscribe"}
        </button>
      </div>
      {status === "error" && (
        <p className="mt-2 text-xs text-red-400" role="alert">
          Couldn&apos;t subscribe. Check your email and try again.
        </p>
      )}
    </form>
  );
}
