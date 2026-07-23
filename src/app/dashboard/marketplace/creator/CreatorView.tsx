"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_TYPES,
  TEMPLATE_TYPE_LABELS,
  CREATOR_SHARE_BPS,
  type Creator,
  type Template,
  type CreatorEarnings,
  type MarketplaceRevenue,
} from "@/lib/marketplace/shared";

interface Props {
  creator: Creator | null;
  templates: Template[];
  payoutsEnabled: boolean;
  connected: boolean;
  connectConfigured: boolean;
  earnings: CreatorEarnings;
  revenue: MarketplaceRevenue | null;
}

const CREATOR_SHARE_PCT = Math.round(CREATOR_SHARE_BPS / 100);

function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export default function CreatorView({
  templates: initialTemplates,
  payoutsEnabled,
  connected,
  connectConfigured,
  earnings,
  revenue,
}: Props) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New-template form.
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [type, setType] = useState<string>("privacy_policy");
  const [price, setPrice] = useState("0");
  const [preview, setPreview] = useState("");
  const [templateBody, setTemplateBody] = useState("");

  const onboard = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/creators", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "onboard" }),
      });
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) throw new Error(data.message ?? data.error ?? "Could not start onboarding.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start onboarding.");
      setBusy(false);
    }
  }, []);

  const create = useCallback(async () => {
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    const dollars = Number(price);
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Enter a valid price.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/templates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          summary,
          category,
          type,
          priceCents: Math.round(dollars * 100),
          preview,
          body: templateBody,
        }),
      });
      const data = (await res.json()) as { template?: Template; error?: string; message?: string };
      if (!res.ok || !data.template) throw new Error(data.message ?? data.error ?? "Could not create template.");
      setTemplates((prev) => [data.template as Template, ...prev]);
      setTitle("");
      setSummary("");
      setPrice("0");
      setCategory("general");
      setType("privacy_policy");
      setPreview("");
      setTemplateBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create template.");
    } finally {
      setBusy(false);
    }
  }, [title, summary, category, type, price, preview, templateBody]);

  const setStatus = useCallback(async (id: string, status: Template["status"]) => {
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/templates/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { template?: Template; error?: string; message?: string };
      if (!res.ok || !data.template) throw new Error(data.message ?? data.error ?? "Could not update status.");
      setTemplates((prev) => prev.map((t) => (t.id === id ? (data.template as Template) : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status.");
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/marketplace/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; message?: string };
        throw new Error(data.message ?? data.error ?? "Could not delete template.");
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete template.");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-xs font-medium text-emerald-300">
              Creator Studio
            </span>
          </div>
          <Link href="/dashboard/marketplace" className="text-sm text-gray-400 hover:text-white transition-colors">
            &larr; Marketplace
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <h1 className="text-2xl font-bold text-white">Creator Studio</h1>

        {/* Your earnings */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-white">Your earnings</h2>
            <span className="text-xs text-gray-500">You keep {CREATOR_SHARE_PCT}% of each sale</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
              <p className="text-xs text-gray-500">Gross revenue</p>
              <p className="text-lg font-bold text-white">{formatUsd(earnings.grossCents)}</p>
            </div>
            <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
              <p className="text-xs text-gray-500">Platform fees</p>
              <p className="text-lg font-bold text-gray-300">{formatUsd(earnings.platformFeeCents)}</p>
            </div>
            <div className="rounded-lg bg-gray-950 border border-emerald-500/30 p-3">
              <p className="text-xs text-emerald-400">Your net</p>
              <p className="text-lg font-bold text-emerald-300">{formatUsd(earnings.netCents)}</p>
            </div>
            <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
              <p className="text-xs text-gray-500">Sales</p>
              <p className="text-lg font-bold text-white">{earnings.sales}</p>
            </div>
          </div>
        </section>

        {/* Marketplace revenue (platform admins only) */}
        {revenue && (
          <section className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white">Marketplace revenue</h2>
              <span className="text-xs text-indigo-300">Platform admin</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-xs text-gray-500">Gross sales</p>
                <p className="text-lg font-bold text-white">{formatUsd(revenue.grossCents)}</p>
              </div>
              <div className="rounded-lg bg-gray-950 border border-indigo-500/30 p-3">
                <p className="text-xs text-indigo-400">Platform revenue</p>
                <p className="text-lg font-bold text-indigo-300">{formatUsd(revenue.platformRevenueCents)}</p>
              </div>
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-xs text-gray-500">Creator payouts</p>
                <p className="text-lg font-bold text-gray-300">{formatUsd(revenue.creatorPayoutCents)}</p>
              </div>
              <div className="rounded-lg bg-gray-950 border border-gray-800 p-3">
                <p className="text-xs text-gray-500">Total sales</p>
                <p className="text-lg font-bold text-white">{revenue.sales}</p>
              </div>
            </div>
          </section>
        )}

        {/* Payouts / Connect status */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
          <h2 className="font-semibold text-white mb-1">Payouts</h2>
          {!connectConfigured ? (
            <p className="text-sm text-amber-300">
              Payments aren&apos;t configured on this deployment yet, so paid templates can&apos;t be sold. Free
              templates still work.
            </p>
          ) : payoutsEnabled ? (
            <p className="text-sm text-emerald-300">
              ✓ Connected — your Stripe account is ready to receive payouts (you keep {CREATOR_SHARE_PCT}% of each
              sale).
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                {connected
                  ? "Finish your Stripe onboarding to start receiving payouts."
                  : `Connect a Stripe account to receive payouts on paid templates. You keep ${CREATOR_SHARE_PCT}% of each sale.`}
              </p>
              <button
                type="button"
                onClick={onboard}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
              >
                {connected ? "Continue setup" : "Connect Stripe"}
              </button>
            </div>
          )}
        </section>

        {/* New template */}
        <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 space-y-3">
          <h2 className="font-semibold text-white">Create a Template</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title *"
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Short summary"
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <textarea
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
            placeholder="Public preview / teaser (shown to everyone before purchase)"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <textarea
            value={templateBody}
            onChange={(e) => setTemplateBody(e.target.value)}
            placeholder="Full deliverable body (delivered to buyers after purchase)"
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 focus:outline-none focus:border-emerald-500"
            >
              {TEMPLATE_TYPES.map((k) => (
                <option key={k} value={k}>
                  {TEMPLATE_TYPE_LABELS[k]}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 focus:outline-none focus:border-emerald-500 capitalize"
            >
              {TEMPLATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">$</span>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-28 px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={create}
              disabled={busy || !title.trim()}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              Create draft
            </button>
          </div>
        </section>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* My templates */}
        <section className="space-y-3">
          <h2 className="font-semibold text-white">Your Templates</h2>
          {templates.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-8 text-center text-gray-500">
              No templates yet. Create your first draft above.
            </div>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">{t.title}</p>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                        t.status === "published"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : t.status === "unlisted"
                            ? "bg-amber-500/15 text-amber-300"
                            : "bg-gray-800 text-gray-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatPrice(t.priceCents, t.currency)} · {TEMPLATE_TYPE_LABELS[t.type]} · {t.category} ·{" "}
                    {t.salesCount} sold
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {t.status === "published" ? (
                    <button
                      type="button"
                      onClick={() => setStatus(t.id, "unlisted")}
                      className="text-xs text-amber-300 hover:text-amber-200"
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setStatus(t.id, "published")}
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                    >
                      Publish
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
