"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { computePaywallTriggers } from "@/lib/funnel/triggers";
import { trackFunnel } from "@/lib/funnel/client";

interface DetectedTool {
  id: string;
  name: string;
  category: string;
}

interface Finding {
  id: string;
  title: string;
  severity: "info" | "warning" | "critical";
  detail: string;
  recommendation: string;
}

interface ScanRecord {
  id: string;
  url: string;
  status: string;
  score: number | null;
  detectedTools: DetectedTool[];
  findings: Finding[];
  summary: string;
  createdAt: string;
}

interface Quota {
  isPremium: boolean;
  used: number;
  limit: number | null;
  remaining: number | null;
}

const SEVERITY_STYLES: Record<string, { border: string; text: string; icon: string }> = {
  info: { border: "border-sky-500/30", text: "text-sky-300", icon: "ℹ️" },
  warning: { border: "border-yellow-500/30", text: "text-yellow-300", icon: "⚠️" },
  critical: { border: "border-red-500/30", text: "text-red-300", icon: "🚨" },
};

function scoreColor(score: number): string {
  return score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
}

/**
 * Compliance Scanner. Runs a URL scan (tool fingerprinting + compliance
 * findings + score) and shows scan history. Free tier is quota-limited; Pro is
 * unlimited.
 */
export default function ScannerPanel() {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [active, setActive] = useState<ScanRecord | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/scanner/scans");
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setHistory(data.scans ?? []);
        setQuota(data.quota ?? null);
        if ((data.scans ?? []).length > 0) setActive(data.scans[0]);
      } catch {
        /* non-fatal */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runScan = useCallback(async () => {
    if (!url.trim()) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scanner/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Scan failed.");
        return;
      }
      const scan: ScanRecord = data.scan;
      setActive(scan);
      setHistory((prev) => [scan, ...prev]);
      setUrl("");
      setQuota((prev) =>
        prev && !prev.isPremium && prev.remaining !== null
          ? { ...prev, used: prev.used + 1, remaining: Math.max(0, prev.remaining - 1) }
          : prev
      );
    } catch {
      setError("Scan failed. Try again.");
    } finally {
      setScanning(false);
    }
  }, [url]);

  const outOfQuota = quota && !quota.isPremium && quota.remaining !== null && quota.remaining <= 0;

  // Contextual paywall triggers for free users, derived from the active scan.
  const triggers = useMemo(() => {
    if (!active || quota?.isPremium) return [];
    const prior = history.find((s) => s.url === active.url && s.createdAt < active.createdAt);
    const unresolvedFindings = active.findings.filter((f) => f.severity !== "info").length;
    return computePaywallTriggers({
      score: active.score,
      previousScore: prior?.score ?? null,
      unresolvedFindings,
    });
  }, [active, history, quota]);

  useEffect(() => {
    if (triggers.length > 0) {
      trackFunnel("paywall_viewed", { surface: "scanner", triggers: triggers.map((t) => t.id).join(",") });
    }
  }, [triggers]);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Compliance Scanner</h2>
        {quota && (
          <span className="text-xs text-gray-500">
            {quota.isPremium ? "Unlimited scans" : `${quota.remaining ?? 0} of ${quota.limit} scans left this month`}
          </span>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runScan()}
            placeholder="https://yourstore.com"
            disabled={scanning || Boolean(outOfQuota)}
            className="flex-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={runScan}
            disabled={scanning || !url.trim() || Boolean(outOfQuota)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
          >
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>

        {outOfQuota && (
          <p className="mt-3 text-xs text-gray-400">
            You&apos;ve used your free scans this month.{" "}
            <Link href="/#pricing" className="text-indigo-400 hover:text-indigo-300">
              Upgrade for unlimited scans &rarr;
            </Link>
          </p>
        )}
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        {active && (
          <div className="mt-5 pt-5 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-300 truncate">{active.url}</p>
              {active.score !== null && (
                <span className={`text-2xl font-bold ${scoreColor(active.score)}`}>{active.score}</span>
              )}
            </div>
            {active.summary && <p className="mt-2 text-xs text-gray-400">{active.summary}</p>}

            {active.detectedTools.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {active.detectedTools.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-0.5 rounded-full bg-gray-800 border border-gray-700 text-xs text-gray-300"
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}

            {active.findings.length > 0 && (
              <div className="mt-4 space-y-2">
                {active.findings.map((f) => {
                  const s = SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.info;
                  return (
                    <div key={f.id} className={`bg-gray-800/50 border ${s.border} rounded-lg p-3`}>
                      <p className={`text-xs font-medium ${s.text}`}>
                        {s.icon} {f.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{f.detail}</p>
                      <p className="text-xs text-gray-500 mt-1">Fix: {f.recommendation}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {triggers.length > 0 && (
              <div className="mt-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4">
                <div className="space-y-1.5">
                  {triggers.map((t) => (
                    <div key={t.id}>
                      <p className="text-xs font-semibold text-indigo-200">{t.headline}</p>
                      <p className="text-xs text-gray-400">{t.detail}</p>
                    </div>
                  ))}
                </div>
                <Link
                  href="/#pricing"
                  onClick={() => trackFunnel("upgrade_cta_clicked", { surface: "scanner" })}
                  className="mt-3 inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
                >
                  Upgrade to fix these &rarr;
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {history.length > 1 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-gray-500 mb-1">Recent scans</p>
          {history.slice(0, 5).map((s) => (
            <button
              key={s.id || s.createdAt}
              type="button"
              onClick={() => setActive(s)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 hover:border-gray-700 transition-colors text-left"
            >
              <span className="text-xs text-gray-400 truncate">{s.url}</span>
              {s.score !== null && <span className={`text-xs font-semibold ${scoreColor(s.score)}`}>{s.score}</span>}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
