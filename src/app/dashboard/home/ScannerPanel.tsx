"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { computePaywallTriggers } from "@/lib/funnel/triggers";
import { computeImprovementPath } from "@/lib/score/improvement";
import { trackClientEvent, trackFunnel } from "@/lib/funnel/client";
import { alertsForRegions } from "@/lib/regulations/alerts";
import { classifyTracker, type TrackerClassification } from "@/lib/scanner/analyzer";
import type { Tier } from "@/lib/pricing";

interface DetectedTool {
  id: string;
  name: string;
  category: string;
  classification?: TrackerClassification;
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
export default function ScannerPanel({ tier }: { tier: Tier }) {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [active, setActive] = useState<ScanRecord | null>(null);
  const [published, setPublished] = useState<{ scanId: string; slug: string } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

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
      trackClientEvent("expansion_nudge_shown", {
        surface: "scanner_findings",
        triggerCount: triggers.length,
      });
    }
  }, [triggers]);

  useEffect(() => {
    if (outOfQuota) {
      trackClientEvent("expansion_nudge_shown", { surface: "scanner_quota_limit" });
    }
  }, [outOfQuota]);

  // Ordered remediation plan for the active scan (highest-impact fixes first).
  const improvement = useMemo(() => {
    if (!active || active.score === null) return null;
    return computeImprovementPath(active.score, active.findings);
  }, [active]);

  // Current regulatory developments to reference alongside scan results, from the
  // canonical feed (single source of truth shared with the dashboard + AI).
  const regulatoryWatch = useMemo(() => alertsForRegions([]).slice(0, 3), []);

  const publish = useCallback(async () => {
    if (!active?.id) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/score/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scanId: active.id, label: active.url }),
      });
      const data = await res.json();
      if (res.ok && data.published?.slug) setPublished({ scanId: active.id, slug: data.published.slug });
    } catch {
      /* non-fatal */
    } finally {
      setPublishing(false);
    }
  }, [active]);

  // Only surface a published slug for the scan it belongs to.
  const publishedSlug = published && published.scanId === active?.id ? published.slug : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const embedSnippet = publishedSlug
    ? `<a href="${origin}/score/${publishedSlug}"><img src="${origin}/api/badge/${publishedSlug}?variant=certified" alt="Comply-Quick Certified" /></a>`
    : "";

  const copyEmbed = useCallback(() => {
    if (!embedSnippet) return;
    navigator.clipboard.writeText(embedSnippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [embedSnippet]);

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
            <Link
              href="/#pricing"
              onClick={() => trackClientEvent("expansion_nudge_clicked", { surface: "scanner_quota_limit" })}
              className="text-indigo-400 hover:text-indigo-300"
            >
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
                    {t.name} ·{" "}
                    {(t.classification ?? classifyTracker(t.category)).consentRequired
                      ? "consent required"
                      : (t.classification ?? classifyTracker(t.category)).label}
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
                <p className="mb-2 text-sm font-bold text-white">
                  Ship compliant, close faster — attorney-grade coverage in minutes, not $5,000 in legal bills.
                </p>
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
                  onClick={() => {
                    trackFunnel("upgrade_cta_clicked", { surface: "scanner" });
                    trackClientEvent("expansion_nudge_clicked", { surface: "scanner_findings" });
                  }}
                  className="mt-3 inline-block px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition-colors"
                >
                  Upgrade to fix these &rarr;
                </Link>
              </div>
            )}

            {improvement && improvement.steps.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-300">Improvement path</p>
                  <p className="text-xs text-gray-500">
                    {improvement.currentScore} &rarr;{" "}
                    <span className="font-semibold text-emerald-400">{improvement.potentialScore}</span> potential
                  </p>
                </div>
                <ol className="mt-2 space-y-1.5">
                  {improvement.steps.map((s) => (
                    <li
                      key={s.findingId}
                      className="flex items-center justify-between gap-3 rounded-lg bg-gray-800/50 border border-gray-700 px-3 py-2"
                    >
                      <span className="text-xs text-gray-300">{s.recommendation}</span>
                      <span className="shrink-0 text-xs font-semibold text-emerald-400">+{s.scoreGain} pts</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {regulatoryWatch.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-300">Regulatory watch</p>
                  {tier === "enterprise" ? (
                    <span className="text-[11px] text-gray-500">Current developments to stay ahead of</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300">
                      Enterprise
                    </span>
                  )}
                </div>
                {tier === "enterprise" ? (
                  <ul className="mt-2 space-y-1.5">
                    {regulatoryWatch.map((a) => {
                      const s = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info;
                      return (
                        <li key={a.id} className={`rounded-lg bg-gray-800/50 border ${s.border} p-3`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs font-medium ${s.text}`}>
                              {s.icon} {a.title}
                            </p>
                            <span className="shrink-0 text-[11px] text-gray-500">{a.date}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">{a.description}</p>
                          <a
                            href={a.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-block text-[11px] text-indigo-400 hover:text-indigo-300"
                          >
                            {a.law} — source &rarr;
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="mt-2 rounded-lg border border-gray-700 bg-gray-800/50 p-3">
                    <div className="space-y-2 blur-sm opacity-60 select-none pointer-events-none">
                      {regulatoryWatch.slice(0, 2).map((a) => (
                        <div key={a.id}>
                          <p className="text-xs font-medium text-gray-300">{a.title}</p>
                          <p className="text-[11px] text-gray-500">{a.law}</p>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                      Live regulatory monitoring tracks your jurisdictions and surfaces changes here.
                    </p>
                    <Link
                      href="/#pricing"
                      onClick={() => {
                        trackFunnel("upgrade_cta_clicked", { surface: "scanner_regwatch" });
                        trackClientEvent("expansion_nudge_clicked", { surface: "scanner_regwatch" });
                      }}
                      className="mt-2 inline-block text-xs font-semibold text-amber-300 hover:text-amber-200"
                    >
                      Upgrade to Enterprise &rarr;
                    </Link>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 border-t border-gray-800 pt-4">
              {!publishedSlug ? (
                <button
                  type="button"
                  onClick={publish}
                  disabled={publishing}
                  className="px-4 py-2 rounded-lg border border-gray-700 text-gray-200 text-xs font-medium hover:border-gray-500 transition-colors disabled:opacity-40"
                >
                  {publishing ? "Publishing\u2026" : "Publish public score page & badge"}
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">
                    Public page:{" "}
                    <a
                      href={`/score/${publishedSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300"
                    >
                      /score/{publishedSlug}
                    </a>
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- dynamic SVG badge from an API route, not a static asset */}
                  <img
                    src={`/api/badge/${publishedSlug}?variant=certified`}
                    alt="Comply-Quick Certified badge"
                    height={20}
                  />
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-gray-800 border border-gray-700 px-2 py-1 text-[11px] text-gray-400">
                      {embedSnippet}
                    </code>
                    <button
                      type="button"
                      onClick={copyEmbed}
                      className="shrink-0 px-3 py-1 rounded-lg text-xs font-medium border border-gray-700 text-gray-300 hover:border-gray-500 transition-colors"
                    >
                      {copied ? "Copied!" : "Copy embed"}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
