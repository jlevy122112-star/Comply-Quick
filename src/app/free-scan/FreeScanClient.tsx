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
    <main className="min-h-screen overflow-hidden bg-[#071014] px-4 py-8 text-slate-100 sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(20,184,166,0.16),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(245,158,11,0.1),transparent_28%)]" />
      <div className="relative mx-auto max-w-6xl">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link href="/" className="text-sm font-bold tracking-[0.18em] text-white">
            COMPLY<span className="text-teal-300">-QUICK</span>
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-400 transition-colors hover:text-white">
            Workspace sign in <span aria-hidden="true">-&gt;</span>
          </Link>
        </header>

        <section className="grid gap-12 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-300">Launch intelligence</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Know what will hold up the next client launch.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Run a fast compliance baseline on any public site. See the highest-impact gaps, the technologies in play,
              and where a workspace can turn findings into deliverables.
            </p>
            <div className="mt-8 grid max-w-xl gap-3 text-sm text-slate-200 sm:grid-cols-3">
              <div className="border-l border-teal-300/60 pl-3">One scan per email</div>
              <div className="border-l border-amber-300/60 pl-3">No card required</div>
              <div className="border-l border-sky-300/60 pl-3">Agency-ready handoff</div>
            </div>
          </div>

          {result ? (
            <div>
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
              className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8"
            >
              <div className="mb-7">
                <p className="text-lg font-semibold text-white">Start with the live site</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">
                  Your result is ready in under a minute for most sites.
                </p>
              </div>
              {needsClaim && (
                <div>
                  <label htmlFor="free-scan-email" className="mb-2 block text-sm font-medium text-slate-200">
                    Work email
                  </label>
                  <input
                    id="free-scan-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@agency.com"
                    className="w-full rounded-xl border border-white/10 bg-[#071014] px-4 py-3 text-white placeholder-slate-600 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300"
                  />
                </div>
              )}
              <div>
                <label htmlFor="free-scan-url" className="mb-2 block text-sm font-medium text-slate-200">
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
                  className="w-full rounded-xl border border-white/10 bg-[#071014] px-4 py-3 text-white placeholder-slate-600 focus:border-teal-300 focus:outline-none focus:ring-1 focus:ring-teal-300"
                />
              </div>
              <button
                type="submit"
                disabled={status === "claiming" || status === "scanning"}
                className="w-full rounded-xl bg-teal-300 px-5 py-3 text-sm font-semibold text-[#071014] transition-colors hover:bg-teal-200 disabled:opacity-60"
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
        </section>
        <footer className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Built for agencies, operators, and launch teams.</span>
          <span>Comply-Quick is not a law firm and does not provide legal advice.</span>
        </footer>
      </div>
    </main>
  );
}
