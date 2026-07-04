"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface Proposal {
  id: string;
  projectId: string;
  projectName: string;
  status: string;
  regulationId: string | null;
  summary: string;
  diff: { addedSections?: string[]; changedSections?: string[]; addedLines?: number; removedLines?: number } | null;
  createdAt: string;
}

/**
 * Compliance Autopilot review queue. Lists proposed document updates the
 * autopilot generated when a tracked regulation changed; the user accepts
 * (applies to the project) or rejects. Pro-gated — free users see an upsell.
 */
export default function AutopilotPanel({ isPremium }: { isPremium: boolean }) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(isPremium);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPremium) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/autopilot/proposals");
        if (!res.ok) throw new Error(`Failed (${res.status})`);
        const data = await res.json();
        if (!active) return;
        setProposals(data.proposals ?? []);
        setError(null);
      } catch {
        if (active) setError("Could not load proposals.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isPremium]);

  const resolve = useCallback(async (id: string, action: "accept" | "reject") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/autopilot/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setProposals((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Compliance Autopilot</h2>
        {!isPremium && (
          <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-xs text-indigo-300">
            Pro
          </span>
        )}
      </div>

      {!isPremium ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
          <p className="text-2xl mb-2">🤖</p>
          <p className="text-xs text-gray-400 mb-2">
            Autopilot watches regulations and proposes document updates automatically — available on Pro plans.
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
      ) : proposals.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-sm text-gray-500">
          No pending proposals. Autopilot will notify you when a tracked regulation changes.
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((p) => (
            <div key={p.id} className="bg-gray-900 border border-indigo-500/20 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-white">{p.projectName}</h3>
                <span className="text-xs text-gray-500 shrink-0">{new Date(p.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{p.summary}</p>
              {p.diff && (
                <p className="text-xs text-gray-500 mt-2">
                  +{p.diff.addedLines ?? 0} / -{p.diff.removedLines ?? 0} lines
                  {(p.diff.changedSections?.length ?? 0) > 0 && ` · ${p.diff.changedSections!.length} sections changed`}
                </p>
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-800">
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => resolve(p.id, "accept")}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
                >
                  {busyId === p.id ? "…" : "Accept & Apply"}
                </button>
                <button
                  type="button"
                  disabled={busyId === p.id}
                  onClick={() => resolve(p.id, "reject")}
                  className="px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 text-xs font-medium hover:border-gray-600 transition-colors disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
