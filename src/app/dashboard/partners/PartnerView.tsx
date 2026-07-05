"use client";

import { useState, useCallback, useMemo } from "react";
import type { PartnerDashboard } from "@/lib/partners/service";

interface Props {
  dashboard: PartnerDashboard | null;
  commissionRate: number;
  connected: boolean;
  payoutsEnabled: boolean;
  connectConfigured: boolean;
}

function formatUsd(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function PartnerView({
  dashboard,
  commissionRate,
  connected,
  payoutsEnabled,
  connectConfigured,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const pct = Math.round(commissionRate * 100);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = useMemo(
    () => (dashboard ? `${origin}/?ref=${dashboard.partner.referralCode}` : ""),
    [dashboard, origin]
  );

  const join = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/partners/join", { method: "POST" });
      const data = (await res.json()) as { partner?: { referralCode: string }; error?: string; message?: string };
      if (!res.ok || !data.partner) throw new Error(data.message ?? data.error ?? "Could not join the program.");
      // Reload to hydrate the full dashboard (referrals, earnings) from the server.
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join the program.");
      setBusy(false);
    }
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/partners/connect", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string; message?: string };
      if (!res.ok || !data.url) throw new Error(data.message ?? data.error ?? "Could not start payout setup.");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start payout setup.");
      setBusy(false);
    }
  }, []);

  const copyLink = useCallback(() => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [referralLink]);

  // ─── Not a partner yet: the join call-to-action ────────────────────────────
  if (!dashboard) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">🤝</p>
        <h1 className="text-2xl font-bold text-white mb-2">Partner Program</h1>
        <p className="text-gray-400 mb-6">
          Refer customers to Comply-Quick and earn <span className="font-semibold text-emerald-400">{pct}%</span> of
          every subscription payment they make — recurring, for as long as they stay subscribed.
        </p>
        {error && <p className="text-sm text-red-400 mb-4">{error}</p>}
        <button
          onClick={join}
          disabled={busy}
          className="inline-block px-6 py-3 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors disabled:opacity-50"
        >
          {busy ? "Joining…" : "Join the Partner Program"}
        </button>
      </main>
    );
  }

  const { earnings, referredCustomers, commissions } = dashboard;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Partner Program</h1>
        <p className="text-gray-400 text-sm mt-1">
          You earn <span className="font-semibold text-emerald-400">{pct}%</span> of every subscription payment from
          customers you refer — recurring for the life of the subscription.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Referral link */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Your referral link</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <code className="flex-1 truncate rounded-lg bg-gray-950 border border-gray-800 px-3 py-2 text-sm text-emerald-300">
            {referralLink}
          </code>
          <button
            onClick={copyLink}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Share this link. Anyone who subscribes after clicking it is credited to you.
        </p>
      </section>

      {/* Earnings summary */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Referred customers" value={String(referredCustomers)} />
        <StatCard label="Total earned" value={formatUsd(earnings.totalCents, earnings.currency)} />
        <StatCard label="Pending payout" value={formatUsd(earnings.accruedCents, earnings.currency)} accent />
        <StatCard label="Paid out" value={formatUsd(earnings.paidCents, earnings.currency)} />
      </section>

      {/* Payouts */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Payouts</h2>
        {!connectConfigured ? (
          <p className="text-sm text-gray-500">
            Payouts aren&apos;t configured on this environment yet. Your commissions are still being tracked and will be
            payable once Stripe is connected.
          </p>
        ) : payoutsEnabled ? (
          <p className="text-sm text-emerald-400">
            ✓ Payouts enabled — your accrued commissions are paid to your connected Stripe account.
          </p>
        ) : (
          <div>
            <p className="text-sm text-gray-400 mb-3">
              {connected
                ? "Finish setting up your Stripe account to receive payouts."
                : "Connect a Stripe account to receive your referral payouts."}
            </p>
            <button
              onClick={connect}
              disabled={busy}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {busy ? "Starting…" : connected ? "Finish payout setup" : "Set up payouts"}
            </button>
          </div>
        )}
      </section>

      {/* Commission ledger */}
      <section className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Commission history</h2>
        {commissions.length === 0 ? (
          <p className="text-sm text-gray-500">
            No commissions yet. Share your referral link — you&apos;ll earn {pct}% each time a referred customer is
            billed.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-800">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Customer payment</th>
                <th className="pb-2 font-medium">Your commission</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr key={c.id} className="border-b border-gray-800/50">
                  <td className="py-2 text-gray-400">{new Date(c.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 text-gray-300">{formatUsd(c.grossCents, c.currency)}</td>
                  <td className="py-2 text-emerald-400 font-medium">{formatUsd(c.commissionCents, c.currency)}</td>
                  <td className="py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        c.status === "paid" ? "bg-emerald-900/50 text-emerald-300" : "bg-amber-900/40 text-amber-300"
                      }`}
                    >
                      {c.status === "paid" ? "Paid" : "Accrued"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-emerald-400" : "text-white"}`}>{value}</p>
    </div>
  );
}
