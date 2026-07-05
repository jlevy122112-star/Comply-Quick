"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Monitor {
  id: string;
  url: string;
  label: string;
  active: boolean;
  lastScannedAt: string | null;
  lastScore: number | null;
  createdAt: string;
}

interface Alert {
  id: string;
  monitorId: string | null;
  scanId: string | null;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  detail: Record<string, unknown>;
  fixRecommendation: string | null;
  read: boolean;
  resolved: boolean;
  createdAt: string;
}

const SEVERITY_STYLES: Record<string, { border: string; icon: string; text: string }> = {
  info: { border: "border-sky-500/30", icon: "ℹ️", text: "text-sky-300" },
  warning: { border: "border-yellow-500/30", icon: "⚠️", text: "text-yellow-300" },
  critical: { border: "border-red-500/30", icon: "🚨", text: "text-red-300" },
};

/**
 * Compliance Intelligence — proactive monitoring + real-time alerts (Phase 4).
 * Users register URLs to watch; a weekly cron re-scans them and raises alerts
 * on increased risk. Each alert has a "Fix It" button that returns an
 * AI-generated remediation plan. Pro-gated — free users see an upsell.
 */
export default function IntelligencePanel({ isPremium }: { isPremium: boolean }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(isPremium);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fixFor, setFixFor] = useState<string | null>(null);
  const [fixText, setFixText] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isPremium) return;
    let active = true;
    (async () => {
      try {
        const [mRes, aRes] = await Promise.all([
          fetch("/api/intelligence/monitors"),
          fetch("/api/intelligence/alerts"),
        ]);
        if (!mRes.ok || !aRes.ok) throw new Error("load failed");
        const [mData, aData] = await Promise.all([mRes.json(), aRes.json()]);
        if (!active) return;
        setMonitors(mData.monitors ?? []);
        setAlerts(aData.alerts ?? []);
        setError(null);
      } catch {
        if (active) setError("Could not load monitoring data.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isPremium]);

  const addMonitor = useCallback(async () => {
    if (!url.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/intelligence/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setMonitors((prev) => [data.monitor, ...prev.filter((m) => m.id !== data.monitor.id)]);
        setUrl("");
      }
    } finally {
      setAdding(false);
    }
  }, [url]);

  const removeMonitor = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/intelligence/monitors/${id}`, { method: "DELETE" });
      if (res.ok) setMonitors((prev) => prev.filter((m) => m.id !== id));
    } finally {
      setBusyId(null);
    }
  }, []);

  const resolveAlert = useCallback(async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/intelligence/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      if (res.ok) setAlerts((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setBusyId(null);
    }
  }, []);

  const fixAlert = useCallback(
    async (id: string) => {
      if (fixText[id]) {
        setFixFor((cur) => (cur === id ? null : id));
        return;
      }
      setFixFor(id);
      setBusyId(id);
      try {
        const res = await fetch(`/api/intelligence/alerts/${id}/fix`, { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setFixText((prev) => ({ ...prev, [id]: data.recommendation ?? "" }));
        }
      } finally {
        setBusyId(null);
      }
    },
    [fixText]
  );

  return (
    <section id="intelligence" className="scroll-mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Compliance Intelligence</h2>
        {!isPremium && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300">
            Pro
          </span>
        )}
      </div>

      {!isPremium ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
          <p className="text-2xl mb-2">📡</p>
          <p className="text-xs text-gray-400 mb-2">
            Monitor client sites weekly and get real-time alerts when a new tracker appears or the compliance score
            drops — available on Pro plans.
          </p>
          <Link
            href="/#pricing"
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Upgrade &rarr;
          </Link>
        </div>
      ) : loading ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-500">Loading…</div>
      ) : error ? (
        <div className="bg-gray-900 border border-red-500/30 rounded-xl p-5 text-sm text-red-400">{error}</div>
      ) : (
        <div className="space-y-4">
          {/* Add monitor */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addMonitor()}
                placeholder="https://client-site.com"
                className="flex-1 min-w-0 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={addMonitor}
                disabled={adding || !url.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40 shrink-0"
              >
                {adding ? "Adding…" : "Watch"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Re-scanned weekly. You&apos;ll be alerted when risk increases.</p>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              {alerts.map((a) => {
                const s = SEVERITY_STYLES[a.severity] ?? SEVERITY_STYLES.info;
                return (
                  <div key={a.id} className={`bg-gray-900 border ${s.border} rounded-xl p-4`}>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0">{s.icon}</span>
                      <div className="min-w-0 flex-1">
                        <h3 className={`text-sm font-semibold ${s.text}`}>{a.title}</h3>
                        <p className="text-xs text-gray-400 mt-1">{a.body}</p>
                        <p className="text-xs text-gray-600 mt-2">{new Date(a.createdAt).toLocaleString()}</p>
                        {fixFor === a.id && fixText[a.id] && (
                          <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-300 bg-gray-950 border border-gray-800 rounded-lg p-3">
                            {fixText[a.id]}
                          </pre>
                        )}
                        <div className="flex items-center gap-2 mt-3">
                          <button
                            type="button"
                            disabled={busyId === a.id}
                            onClick={() => fixAlert(a.id)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
                          >
                            {busyId === a.id && fixFor === a.id ? "…" : fixText[a.id] ? "Toggle Fix" : "Fix It"}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === a.id}
                            onClick={() => resolveAlert(a.id)}
                            className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs font-medium hover:border-gray-600 transition-colors disabled:opacity-40"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Monitors list */}
          {monitors.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-5 text-sm text-gray-500 text-center">
              No sites monitored yet. Add a client URL above to start weekly compliance monitoring.
            </div>
          ) : (
            <div className="space-y-2">
              {monitors.map((m) => (
                <div
                  key={m.id}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{m.label || m.url}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {m.lastScannedAt
                        ? `Last scanned ${new Date(m.lastScannedAt).toLocaleDateString()}`
                        : "Awaiting first scan"}
                      {typeof m.lastScore === "number" ? ` · score ${m.lastScore}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === m.id}
                    onClick={() => removeMonitor(m.id)}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
