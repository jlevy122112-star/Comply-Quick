"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { Tier } from "@/lib/entitlements";
import type { ApiKeyRecord } from "@/lib/api/keys";
import type { ApiUsageSummary } from "@/lib/api/usage";
import { paidPlansLabel, tierLabel } from "@/lib/tier-copy";
import { UpsellCta } from "@/components/ui";

// ─── Display helpers ────────────────────────────────────────────────────────

const METER_LABELS: Record<string, string> = {
  api_call: "API calls",
  api_template_upload: "Template uploads (API)",
  extra_scan: "Scan overage",
};

const PRICING = [
  { label: "Per API call", price: "$0.01", meter: "api_call" },
  { label: "Per template upload (API only)", price: "$50.00", meter: "api_template_upload" },
  { label: "Per extra scan (beyond plan limit)", price: "$5.00", meter: "extra_scan" },
];

function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function meterLabel(meter: string): string {
  return METER_LABELS[meter] ?? meter;
}

// ─── Main View ──────────────────────────────────────────────────────────────

interface ApiViewProps {
  tier: Tier;
  canUseApi: boolean;
  initialKeys: ApiKeyRecord[];
  usage: ApiUsageSummary | null;
}

export default function ApiView({ tier, canUseApi, initialKeys, usage }: ApiViewProps) {
  const [keys, setKeys] = useState<ApiKeyRecord[]>(initialKeys);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);

  const createKey = useCallback(async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || "API key" }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message ?? data.error;
        setError(typeof msg === "string" ? msg : "Could not create key.");
        return;
      }
      setNewKey(data.key as string);
      setKeys((prev) => [data.record as ApiKeyRecord, ...prev]);
      setName("");
    } catch {
      setError("Network error creating key.");
    } finally {
      setCreating(false);
    }
  }, [name]);

  const revokeKey = useCallback(async (id: string) => {
    const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k)));
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs font-medium text-indigo-300">
              API
            </span>
          </div>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-gray-200 transition-colors">
            &larr; Back to dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        <div>
          <h1 className="text-2xl font-bold text-white">Developer API</h1>
          <p className="text-sm text-gray-400 mt-1">
            Generate compliance packages and upload templates programmatically. Usage is billed on top of your plan.
          </p>
        </div>

        {!canUseApi ? (
          <UpgradeGate tier={tier} />
        ) : (
          <>
            <UsageSection usage={usage} />
            <KeysSection
              keys={keys}
              name={name}
              setName={setName}
              creating={creating}
              error={error}
              newKey={newKey}
              onCreate={createKey}
              onRevoke={revokeKey}
              onDismissNewKey={() => setNewKey(null)}
            />
          </>
        )}

        <DocsSection />
      </main>
    </div>
  );
}

// ─── Upgrade gate ───────────────────────────────────────────────────────────

function UpgradeGate({ tier }: { tier: Tier }) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
      <p className="text-2xl mb-2">⚡</p>
      <h2 className="text-lg font-semibold text-white mb-2">The API is a paid feature</h2>
      <p className="text-sm text-gray-400 mb-4">
        You&rsquo;re on the <span className="font-medium">{tierLabel(tier)}</span> plan. Upgrade to {paidPlansLabel()}{" "}
        to issue API keys and integrate Comply-Quick into your stack.
      </p>
      <div className="mx-auto mt-4 max-w-sm text-left">
        <UpsellCta
          tier={tier}
          title="Unlock the Developer API"
          benefit="Issue API keys and integrate compliance workflows into your stack."
        />
      </div>
    </section>
  );
}

// ─── Usage ──────────────────────────────────────────────────────────────────

function UsageSection({ usage }: { usage: ApiUsageSummary | null }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Usage this month</h2>
        {usage && <span className="text-xs text-gray-500">{usage.period}</span>}
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {usage && usage.lines.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-800/40 text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Meter</th>
                <th className="text-right px-4 py-3 font-medium">Quantity</th>
                <th className="text-right px-4 py-3 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {usage.lines.map((line) => (
                <tr key={line.meter} className="border-t border-gray-800">
                  <td className="px-4 py-3 text-gray-200">{meterLabel(line.meter)}</td>
                  <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{line.quantity.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-300 tabular-nums">{money(line.costCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700 bg-gray-800/30">
                <td className="px-4 py-3 font-semibold text-white" colSpan={2}>
                  Total metered charges
                </td>
                <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">
                  {money(usage.totalCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No metered usage yet this month.</p>
        )}
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Metered charges accrue in real time and are reported to Stripe on your next renewal.
      </p>
    </section>
  );
}

// ─── Keys ───────────────────────────────────────────────────────────────────

interface KeysSectionProps {
  keys: ApiKeyRecord[];
  name: string;
  setName: (v: string) => void;
  creating: boolean;
  error: string | null;
  newKey: string | null;
  onCreate: () => void;
  onRevoke: (id: string) => void;
  onDismissNewKey: () => void;
}

function KeysSection({
  keys,
  name,
  setName,
  creating,
  error,
  newKey,
  onCreate,
  onRevoke,
  onDismissNewKey,
}: KeysSectionProps) {
  const activeKeys = keys.filter((k) => !k.revokedAt);
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">API keys</h2>

      {newKey && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-300 mb-2">
            Your new key — copy it now. It won&rsquo;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-emerald-200 bg-gray-900/70 rounded-lg p-3 overflow-x-auto break-all">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(newKey)}
              className="shrink-0 px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-xs font-medium hover:border-emerald-400 transition-colors"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={onDismissNewKey}
              className="shrink-0 px-3 py-2 rounded-lg border border-gray-700 text-gray-400 text-xs font-medium hover:border-gray-600 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. Production integration)"
          maxLength={80}
          className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-100 placeholder-gray-600 focus:border-indigo-500 focus:outline-none"
        />
        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-40"
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        {activeKeys.length > 0 ? (
          <ul className="divide-y divide-gray-800">
            {activeKeys.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{k.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <code className="text-gray-400">{k.keyPrefix}…</code> &middot; created{" "}
                    {new Date(k.createdAt).toLocaleDateString()} &middot;{" "}
                    {k.lastUsedAt ? `last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "never used"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRevoke(k.id)}
                  className="shrink-0 text-xs text-gray-500 hover:text-red-400 transition-colors"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No active keys. Create one to start using the API.
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Docs / reference ───────────────────────────────────────────────────────

const CURL_EXAMPLE = `curl -X POST https://comply-quick.com/api/v1/compliance \\
  -H "Authorization: Bearer cq_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "userType": "merchant",
    "framework": "shopify",
    "trackingPixels": ["meta", "google"],
    "targetRegions": ["us_general", "eu_gdpr"]
  }'`;

function DocsSection() {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">API reference</h2>

      <div className="space-y-6 text-sm text-gray-300">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-2">Authentication</h3>
          <p className="text-gray-400 mb-3">
            Pass your key as a bearer token. Keys start with <code className="text-indigo-400">cq_live_</code> and are
            shown only once at creation.
          </p>
          <code className="block text-xs text-indigo-300 bg-gray-800/50 rounded-lg p-3 overflow-x-auto">
            Authorization: Bearer cq_live_your_key_here
          </code>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Endpoints</h3>
          <ul className="space-y-2">
            <Endpoint method="POST" path="/api/v1/compliance" desc="Generate a compliance package. Metered per call." />
            <Endpoint
              method="POST"
              path="/api/v1/templates"
              desc="Upload a marketplace template. Metered per call + $50 upload."
            />
            <Endpoint method="GET" path="/api/v1/usage" desc="Return your metered usage for the current month." />
          </ul>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Pricing</h3>
          <ul className="space-y-1">
            {PRICING.map((p) => (
              <li key={p.meter} className="flex items-center justify-between">
                <span className="text-gray-400">{p.label}</span>
                <span className="text-gray-200 tabular-nums">{p.price}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-2">Rate limits</h3>
          <p className="text-gray-400">
            120 requests per minute per key. Every response includes{" "}
            <code className="text-indigo-400">X-RateLimit-Limit</code>,{" "}
            <code className="text-indigo-400">X-RateLimit-Remaining</code>, and{" "}
            <code className="text-indigo-400">X-RateLimit-Reset</code> headers. Exceeding the limit returns{" "}
            <code className="text-indigo-400">429</code>.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-2">Example</h3>
          <pre className="text-xs text-gray-300 bg-gray-800/50 rounded-lg p-3 overflow-x-auto whitespace-pre">
            {CURL_EXAMPLE}
          </pre>
        </div>
      </div>
    </section>
  );
}

function Endpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  return (
    <li className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
      <span className="inline-flex items-center gap-2 shrink-0">
        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-semibold">
          {method}
        </span>
        <code className="text-xs text-gray-200">{path}</code>
      </span>
      <span className="text-xs text-gray-500">{desc}</span>
    </li>
  );
}
