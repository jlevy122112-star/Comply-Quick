"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicScanResult } from "@/app/api/public-scan/route";
import { ScanResultCard } from "./ScanResultCard";

type Status = "idle" | "scanning" | "done" | "error";

export function HeroScan({ startHref }: { startHref: string }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PublicScanResult | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "scanning" || !url.trim()) return;
    setStatus("scanning");
    setError("");
    try {
      const res = await fetch("/api/public-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
        setStatus("error");
        return;
      }
      setResult(data as PublicScanResult);
      setStatus("done");
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("error");
    }
  }

  if (status === "done" && result) {
    return (
      <div className="mt-10">
        <ScanResultCard result={result} />
        <button
          onClick={() => {
            setStatus("idle");
            setResult(null);
            setUrl("");
          }}
          className="mt-4 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          Scan Another Site
        </button>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
        <div className="flex flex-col sm:flex-row gap-3">
          <label htmlFor="hero-scan-url" className="sr-only">
            Website URL
          </label>
          <input
            id="hero-scan-url"
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourwebsite.com"
            className="flex-1 min-w-0 px-4 py-4 rounded-xl bg-gray-900 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={status === "scanning"}
            className="px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {status === "scanning" ? "Scanning\u2026" : "Scan My Site Free"}
          </button>
        </div>
      </form>
      {status === "error" && (
        <p className="mt-3 text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
      <p className="mt-4 text-xs text-gray-300">
        Instant score, no account needed.{" "}
        <Link href={startHref} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
          Or Get Started Free &rarr;
        </Link>
      </p>
    </div>
  );
}
