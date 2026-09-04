"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PublicScanResult } from "@/app/api/public-scan/route";
import { ScanResultCard } from "@/components/landing/ScanResultCard";

type Status = "idle" | "claiming" | "scanning" | "done" | "error";

interface ClaimResponse {
  ok?: boolean;
  token?: string;
  error?: string;
}

export default function FreeScanClient({ initialToken }: { initialToken: string | null }) {
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [token, setToken] = useState<string | null>(initialToken);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<PublicScanResult | null>(null);

  const needsClaim = useMemo(() => !token, [token]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim() || status === "claiming" || status === "scanning") return;
    setError("");
    let activeToken = token;

    if (!activeToken) {
      if (!email.trim()) {
        setError("Enter your email to claim a free scan.");
        return;
      }
      setStatus("claiming");
      const claimRes = await fetch("/api/free-scan/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, source: "free_scan_page" }),
      });
      const claimData: ClaimResponse = await claimRes.json().catch(() => ({}));
      if (!claimRes.ok || typeof claimData.token !== "string") {
        setStatus("error");
        setError(
          claimData.error === "already_used"
            ? "This email already used its one-time free scan. Start a workspace to keep scanning."
            : "Could not claim a free scan token."
        );
        return;
      }
      activeToken = claimData.token;
      setToken(activeToken);
    }

    setStatus("scanning");
    const scanRes = await fetch("/api/public-scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, token: activeToken }),
    });
    const scanData = await scanRes.json().catch(() => ({}));
    if (!scanRes.ok) {
      setStatus("error");
      setToken(null);
      setError(typeof scanData.error === "string" ? scanData.error : "Scan failed.");
      return;
    }
    setResult(scanData as PublicScanResult);
    setStatus("done");
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-12 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Run your one-time free scan</h1>
        <p className="mt-3 text-sm text-gray-300">
          Agency-first launch mode: this one-time scan gives a quick baseline before workspace onboarding.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Comply-Quick is not a law firm and does not provide legal advice. Consult counsel for legal decisions.
        </p>

        {result ? (
          <div className="mt-8">
            <ScanResultCard result={result} />
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard?utm_source=free_scan&utm_medium=cta&utm_campaign=agency_first"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Create workspace
              </Link>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4 rounded-2xl border border-gray-800 bg-gray-900/70 p-6"
          >
            {needsClaim && (
              <div>
                <label htmlFor="free-scan-email" className="mb-1 block text-sm font-medium text-gray-200">
                  Work email
                </label>
                <input
                  id="free-scan-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@agency.com"
                  className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}
            <div>
              <label htmlFor="free-scan-url" className="mb-1 block text-sm font-medium text-gray-200">
                Website URL
              </label>
              <input
                id="free-scan-url"
                type="text"
                required
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="clientsite.com"
                className="w-full rounded-xl border border-gray-700 bg-gray-950 px-4 py-3 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={status === "claiming" || status === "scanning"}
              className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-60"
            >
              {status === "claiming" ? "Claiming token…" : status === "scanning" ? "Scanning…" : "Run free scan"}
            </button>
            {error && (
              <p role="alert" className="text-sm text-rose-300">
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
