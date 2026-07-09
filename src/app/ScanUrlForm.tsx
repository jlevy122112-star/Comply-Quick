"use client";

// GTM §10 #3 — Scan-first hero CTA. Accepts a URL, appends UTM params, and
// navigates to the scanner page with the URL pre-populated.

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

const SCAN_BASE = "/dashboard/home?utm_source=landing&utm_medium=cta&utm_campaign=free_scan";

function buildScanHref(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  // Prefix with https:// if the user omitted the protocol so the URL field is
  // valid and the scanner receives a well-formed URL.
  const withProtocol = trimmed && !trimmed.match(/^https?:\/\//i) ? `https://${trimmed}` : trimmed;
  const encoded = encodeURIComponent(withProtocol);
  return `${SCAN_BASE}&url=${encoded}`;
}

export default function ScanUrlForm() {
  const [value, setValue] = useState("");
  const router = useRouter();

  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const href = buildScanHref(value);
      router.push(href);
    },
    [value, router]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 w-full max-w-xl mx-auto flex flex-col sm:flex-row gap-3"
      aria-label="Scan your site for compliance risks"
    >
      <label htmlFor="scan-url" className="sr-only">
        Enter your website URL
      </label>
      <input
        id="scan-url"
        type="url"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://yoursite.com"
        className="flex-1 px-4 py-3.5 rounded-xl bg-gray-800/80 border border-gray-700 text-white placeholder-gray-500 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        autoComplete="url"
        inputMode="url"
      />
      <button
        type="submit"
        className="shrink-0 px-6 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-500 active:bg-indigo-700 transition-colors whitespace-nowrap"
      >
        Scan free →
      </button>
    </form>
  );
}
