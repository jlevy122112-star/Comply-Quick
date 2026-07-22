"use client";

import type { AgencyPortfolioAnalytics } from "@/lib/agency/analytics";

function SummaryCard({ label, value, tone = "text-white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export default function PortfolioAnalytics({ analytics }: { analytics: AgencyPortfolioAnalytics }) {
  return (
    <section className="space-y-6" aria-labelledby="portfolio-heading">
      <div>
        <h2 id="portfolio-heading" className="text-lg font-semibold text-white">
          Portfolio analytics
        </h2>
        <p className="mt-1 text-sm text-gray-400">
          Aggregated compliance health across your managed client portfolio.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard label="Portfolio average" value={`${analytics.summary.averageScore}/100`} tone="text-indigo-300" />
        <SummaryCard
          label="Clients at risk"
          value={analytics.summary.clientsAtRisk}
          tone={analytics.summary.clientsAtRisk > 0 ? "text-amber-300" : "text-emerald-300"}
        />
        <SummaryCard label="Open findings" value={analytics.summary.totalOpenFindings} tone="text-red-300" />
        <SummaryCard label="Clients" value={analytics.summary.clientCount} />
      </div>

      {analytics.clients.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/60 p-10 text-center">
          <p className="text-sm font-medium text-gray-300">No client portfolio data yet</p>
          <p className="mt-1 text-sm text-gray-500">Add a client to start tracking compliance health.</p>
        </div>
      )}
    </section>
  );
}
