"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { TEMPLATE_CATEGORIES, type TemplateListing } from "@/lib/marketplace/shared";

interface Props {
  templates: TemplateListing[];
  purchasedIds: string[];
  canSell: boolean;
}

/** Formats whole cents as a currency string, or "Free" for 0. */
function formatPrice(cents: number, currency: string): string {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function MarketplaceView({ templates, purchasedIds, canSell }: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [owned, setOwned] = useState<Set<string>>(new Set(purchasedIds));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (q && !t.title.toLowerCase().includes(q) && !t.summary.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [templates, search, category]);

  const buy = useCallback(async (template: TemplateListing) => {
    setBusyId(template.id);
    setError(null);
    try {
      const res = await fetch("/api/marketplace/purchases", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: template.id }),
      });
      const data = (await res.json()) as { url?: string; claimed?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Purchase failed.");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.claimed) setOwned((prev) => new Set(prev).add(template.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setBusyId(null);
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
              Marketplace
            </span>
          </div>
          <div className="flex items-center gap-4">
            {canSell && (
              <Link href="/dashboard/marketplace/creator" className="text-sm text-emerald-300 hover:text-emerald-200">
                Sell templates &rarr;
              </Link>
            )}
            <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white transition-colors">
              &larr; Command Center
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Template Marketplace</h1>
          <p className="text-sm text-gray-400 mt-1">
            Buy ready-made compliance presets from other agencies, or publish your own and earn on every sale.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="flex-1 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 text-sm text-gray-100 focus:outline-none focus:border-emerald-500 capitalize"
          >
            <option value="all">All categories</option>
            {TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/40 p-10 text-center text-gray-500">
            No templates match your search yet.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const isOwned = owned.has(t.id);
              return (
                <div key={t.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold text-white">{t.title}</h2>
                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-300 capitalize">
                      {t.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">by {t.creatorName}</p>
                  <p className="text-sm text-gray-400 mt-2 flex-1">{t.summary || "No description provided."}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm font-semibold text-white">{formatPrice(t.priceCents, t.currency)}</span>
                    {isOwned ? (
                      <span className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs font-medium text-emerald-300">
                        Owned
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => buy(t)}
                        disabled={busyId === t.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                      >
                        {busyId === t.id ? "…" : t.priceCents === 0 ? "Get" : "Buy"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
