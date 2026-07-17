"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { switchActiveOrganizationAction } from "@/app/dashboard/actions";
import type { AgencyClientAnalytics, AgencyPortfolioAnalytics, PortfolioRisk } from "@/lib/agency/analytics";

type SortKey = "name" | "score" | "projects" | "openFindings";

const riskStyles: Record<PortfolioRisk, string> = {
  good: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
  none: "bg-gray-500/15 text-gray-300 border-gray-500/30",
};

function riskLabel(risk: PortfolioRisk): string {
  return risk === "good" ? "Healthy" : risk === "warning" ? "Watch" : risk === "critical" ? "Critical" : "No data";
}

function SummaryCard({ label, value, tone = "text-white" }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

export default function PortfolioAnalytics({ analytics }: { analytics: AgencyPortfolioAnalytics }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [ascending, setAscending] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedClients = useMemo(() => {
    return [...analytics.clients].sort((a, b) => {
      const left = sortKey === "name" ? a.name : a[sortKey];
      const right = sortKey === "name" ? b.name : b[sortKey];
      const comparison =
        typeof left === "string"
          ? left.localeCompare(right as string)
          : left === null
            ? right === null
              ? 0
              : 1
            : right === null
              ? -1
              : left - (right as number);
      return ascending ? comparison : -comparison;
    });
  }, [analytics.clients, ascending, sortKey]);

  const sortBy = (key: SortKey) => {
    if (key === sortKey) setAscending((value) => !value);
    else {
      setSortKey(key);
      setAscending(key === "name");
    }
  };

  const openWorkspace = async (client: AgencyClientAnalytics) => {
    if (!client.organizationId) return;
    setError(null);
    setOpening(client.clientId);
    const result = await switchActiveOrganizationAction(client.organizationId);
    if (result.ok) router.push("/dashboard/home");
    else setError(result.error);
    setOpening(null);
  };

  return (
    <section className="space-y-6" aria-labelledby="portfolio-heading">
      <div>
        <h2 id="portfolio-heading" className="text-lg font-semibold text-white">
          Portfolio analytics
        </h2>
        <p className="mt-1 text-sm text-gray-400">Aggregated compliance health across your managed client portfolio.</p>
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

      {analytics.clients.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/60 p-10 text-center">
          <p className="text-sm font-medium text-gray-300">No client portfolio data yet</p>
          <p className="mt-1 text-sm text-gray-500">Add a client to start tracking compliance health.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
              <caption className="sr-only">Compliance health by managed client</caption>
              <thead className="bg-gray-950/60 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  {[
                    ["name", "Client"],
                    ["score", "Score"],
                    ["projects", "Projects"],
                    ["openFindings", "Open findings"],
                  ].map(([key, label]) => (
                    <th key={key} scope="col" className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => sortBy(key as SortKey)}
                        className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                        aria-label={`Sort by ${label}`}
                      >
                        {label} {sortKey === key ? (ascending ? "↑" : "↓") : ""}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3">
                    Health
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Workspace
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sortedClients.map((client) => (
                  <tr key={client.clientId} className="text-gray-300">
                    <th scope="row" className="px-4 py-4 font-medium text-white">
                      <div>{client.name}</div>
                      <div className="mt-1 text-xs font-normal text-gray-500">
                        {client.status === "archived"
                          ? "Archived"
                          : client.provisioned
                            ? "Provisioned"
                            : "Unprovisioned"}
                      </div>
                    </th>
                    <td className="px-4 py-4 font-semibold text-white">
                      {client.score === null ? <span aria-label="No compliance data">—</span> : client.score}
                    </td>
                    <td className="px-4 py-4">{client.projects}</td>
                    <td className="px-4 py-4">{client.openFindings}</td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-2 py-1 text-xs font-medium ${riskStyles[client.risk]}`}>
                        {riskLabel(client.risk)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {client.provisioned ? (
                        <button
                          type="button"
                          onClick={() => openWorkspace(client)}
                          disabled={opening === client.clientId}
                          className="rounded text-xs font-medium text-indigo-300 hover:text-indigo-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:opacity-50"
                        >
                          {opening === client.clientId ? "Opening…" : "Open workspace →"}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">Not provisioned</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400" role="alert" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  );
}
