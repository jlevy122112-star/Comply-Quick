"use client";

import { useState } from "react";
import { FLAG_REGISTRY, type FeatureFlagKey } from "@/lib/flags/registry";
import type { FeatureFlagAuditEntry, ResolvedFlag } from "@/lib/flags/service";
import { setOrgFlagAction } from "./actions";

export function FeatureFlagsPanel({
  organizationId,
  organizationName,
  flags,
  audit,
  canManage,
}: {
  organizationId: string;
  organizationName: string;
  flags: ResolvedFlag[];
  audit: FeatureFlagAuditEntry[];
  canManage: boolean;
}) {
  const [rows, setRows] = useState(flags);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState<FeatureFlagKey | null>(null);

  const toggle = async (key: FeatureFlagKey, enabled: boolean) => {
    setSaving(key);
    setMessage(null);
    const result = await setOrgFlagAction(organizationId, key, enabled);
    if (result.ok) {
      setRows((current) => current.map((row) => (row.key === key ? { ...row, enabled, source: "organization" } : row)));
      setMessage("Feature flag updated.");
    } else {
      setMessage(result.error);
    }
    setSaving(null);
  };

  return (
    <section className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Feature flags</h2>
        <p className="mt-1 text-sm text-gray-300">Managing feature flags for {organizationName}</p>
        <p className="mt-1 text-sm text-gray-400">Organization overrides take precedence over environment defaults.</p>
      </div>
      {message && (
        <p role="status" className="text-sm text-gray-300">
          {message}
        </p>
      )}
      <div className="divide-y divide-gray-800">
        {rows.map((flag) => (
          <div key={flag.key} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium capitalize text-white">{FLAG_REGISTRY[flag.key].label}</p>
              <p className="text-xs text-gray-400">{FLAG_REGISTRY[flag.key].description}</p>
              <p className="text-xs text-gray-500">Effective source: {flag.source}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={flag.enabled}
              aria-label={`Toggle ${flag.key}`}
              disabled={!canManage || saving === flag.key}
              onClick={() => toggle(flag.key, !flag.enabled)}
              className={`rounded-full px-3 py-1 text-sm ${flag.enabled ? "bg-emerald-700 text-white" : "bg-gray-700 text-gray-200"} disabled:opacity-40`}
            >
              {flag.enabled ? "On" : "Off"}
            </button>
          </div>
        ))}
      </div>
      <div>
        <h3 className="font-medium text-white">Recent Changes</h3>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">No changes recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-gray-400">
            {audit.map((entry) => (
              <li key={entry.id}>
                {entry.flagKey}: {entry.previousEnabled === null ? "default" : String(entry.previousEnabled)} →{" "}
                {String(entry.newEnabled)} · {new Date(entry.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
