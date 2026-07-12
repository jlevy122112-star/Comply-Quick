"use client";

import type { BreachStatus, ComputedObligation } from "@/lib/privacy/breach";
import type { IncidentView } from "./page";
import { STATE_STYLES, STATE_LABELS, fmt } from "./format";

const STATUSES: BreachStatus[] = ["open", "contained", "notifying", "resolved", "closed"];

interface Props {
  view: IncidentView;
  busy: boolean;
  onPatch: (id: string, payload: Record<string, unknown>) => void;
}

function ObligationRow({
  obligation,
  incidentId,
  busy,
  onPatch,
}: {
  obligation: ComputedObligation;
  incidentId: string;
  busy: boolean;
  onPatch: (id: string, payload: Record<string, unknown>) => void;
}) {
  const o = obligation;
  return (
    <li
      className={`flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${STATE_STYLES[o.state]}`}
    >
      <div>
        <span className="font-medium">{o.framework}</span> — {o.basis}
        <span className="mt-0.5 block text-xs opacity-80">
          {STATE_LABELS[o.state]} · due {fmt(o.dueAt)} · {o.authority}
          {o.satisfied && ` · notified ${fmt(o.notifiedAt)}`}
        </span>
      </div>
      <button
        onClick={() =>
          onPatch(incidentId, { notify: { ruleId: o.id, at: o.satisfied ? null : new Date().toISOString() } })
        }
        disabled={busy}
        className="shrink-0 rounded-md border border-current px-3 py-1 text-xs font-medium hover:opacity-80 disabled:opacity-50"
      >
        {o.satisfied ? "Undo notified" : "Mark notified"}
      </button>
    </li>
  );
}

export function IncidentCard({ view, busy, onPatch }: Props) {
  const { incident, obligations } = view;
  return (
    <section className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{incident.title}</h3>
          <p className="mt-1 text-xs text-gray-500">
            {incident.severity} · discovered {fmt(incident.discoveredAt)} · {incident.affectedIndividuals} affected
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-400">
          Status
          <select
            value={incident.status}
            onChange={(e) => onPatch(incident.id, { status: e.target.value })}
            disabled={busy}
            className="rounded-md border border-gray-700 bg-gray-900 px-2 py-1 text-gray-100 focus:border-indigo-500 focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>

      {incident.description && <p className="mt-3 text-sm text-gray-400">{incident.description}</p>}

      {obligations.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {obligations.map((o) => (
            <ObligationRow key={o.id} obligation={o} incidentId={incident.id} busy={busy} onPatch={onPatch} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-xs text-gray-500">
          No fixed notification deadlines derived — add affected jurisdictions/data categories to compute them.
        </p>
      )}
    </section>
  );
}
