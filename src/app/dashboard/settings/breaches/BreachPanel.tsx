"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IncidentView } from "./page";
import type { BreachSeverity, BreachStatus, ComputedObligation, ObligationState } from "@/lib/privacy/breach";

interface Props {
  views: IncidentView[];
  regionOptions: { id: string; name: string }[];
  dataCategoryOptions: string[];
}

const SEVERITIES: BreachSeverity[] = ["low", "medium", "high", "critical"];
const STATUSES: BreachStatus[] = ["open", "contained", "notifying", "resolved", "closed"];

const STATE_STYLES: Record<ObligationState, string> = {
  met: "border-emerald-800/50 bg-emerald-950/40 text-emerald-300",
  upcoming: "border-sky-800/50 bg-sky-950/40 text-sky-300",
  due_soon: "border-amber-800/50 bg-amber-950/40 text-amber-300",
  overdue: "border-red-800/50 bg-red-950/40 text-red-300",
};

const STATE_LABELS: Record<ObligationState, string> = {
  met: "Notified",
  upcoming: "Upcoming",
  due_soon: "Due soon",
  overdue: "Overdue",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
}

export function BreachPanel({ views, regionOptions, dataCategoryOptions }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(views.length === 0);

  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<BreachSeverity>("medium");
  const [discoveredAt, setDiscoveredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [affected, setAffected] = useState("0");
  const [highRisk, setHighRisk] = useState(false);
  const [regions, setRegions] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  function toggle(list: string[], value: string, set: (v: string[]) => void) {
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/breaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          severity,
          discoveredAt: new Date(`${discoveredAt.length === 16 ? `${discoveredAt}:00` : discoveredAt}Z`).toISOString(),
          affectedIndividuals: Number(affected) || 0,
          highRisk,
          regions,
          dataCategories: categories,
          description: description || null,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not record the breach.");
      }
      setTitle("");
      setDescription("");
      setAffected("0");
      setRegions([]);
      setCategories([]);
      setHighRisk(false);
      setSeverity("medium");
      setDiscoveredAt(new Date().toISOString().slice(0, 16));
      setShowForm(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the breach.");
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/privacy/breaches/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not update the incident.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the incident.");
    } finally {
      setBusy(false);
    }
  }

  function markNotified(o: ComputedObligation, id: string) {
    const field = o.audience === "authority" ? "authorityNotifiedAt" : "individualsNotifiedAt";
    patch(id, { [field]: new Date().toISOString() });
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-md border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-md border border-gray-700 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800"
        >
          {showForm ? "Cancel" : "Report a Breach"}
        </button>
      </div>

      {showForm && (
        <section className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-5">
          <h2 className="text-lg font-semibold text-white">Report a Breach</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-gray-300">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exposed customer export in storage bucket"
                className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-300">Severity</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BreachSeverity)}
                className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-300">Discovered at (UTC)</span>
              <input
                type="datetime-local"
                value={discoveredAt}
                onChange={(e) => setDiscoveredAt(e.target.value)}
                className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-300">Affected individuals</span>
              <input
                type="number"
                min="0"
                value={affected}
                onChange={(e) => setAffected(e.target.value)}
                className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={highRisk} onChange={(e) => setHighRisk(e.target.checked)} />
              <span className="text-gray-300">High risk to individuals (triggers direct notification)</span>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-gray-300">Affected jurisdictions</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {regionOptions.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggle(regions, r.id, setRegions)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      regions.includes(r.id)
                        ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
                        : "border-gray-700 text-gray-400 hover:bg-gray-800"
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="sm:col-span-2">
              <legend className="text-sm text-gray-300">Data categories involved</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {dataCategoryOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggle(categories, c, setCategories)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      categories.includes(c)
                        ? "border-indigo-500 bg-indigo-950/50 text-indigo-200"
                        : "border-gray-700 text-gray-400 hover:bg-gray-800"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              <span className="text-gray-300">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-gray-100 focus:border-indigo-500 focus:outline-none"
              />
            </label>
          </div>
          <button
            onClick={submit}
            disabled={busy || !title.trim()}
            className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Record Incident"}
          </button>
        </section>
      )}

      {views.length === 0 && !showForm && <p className="text-sm text-gray-500">No breach incidents recorded.</p>}

      <div className="space-y-6">
        {views.map(({ incident, obligations }) => (
          <section key={incident.id} className="rounded-lg border border-gray-800/60 bg-gray-900/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-white">{incident.title}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {incident.severity} · discovered {fmt(incident.discoveredAt)} · {incident.affectedIndividuals}{" "}
                  affected
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-400">
                Status
                <select
                  value={incident.status}
                  onChange={(e) => patch(incident.id, { status: e.target.value })}
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
                  <li
                    key={o.id}
                    className={`flex flex-col gap-2 rounded-md border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between ${STATE_STYLES[o.state]}`}
                  >
                    <div>
                      <span className="font-medium">{o.framework}</span> — {o.basis}
                      <span className="mt-0.5 block text-xs opacity-80">
                        {STATE_LABELS[o.state]} · due {fmt(o.dueAt)} · {o.authority}
                      </span>
                    </div>
                    {!o.satisfied && (
                      <button
                        onClick={() => markNotified(o, incident.id)}
                        disabled={busy}
                        className="shrink-0 rounded-md border border-current px-3 py-1 text-xs font-medium hover:opacity-80 disabled:opacity-50"
                      >
                        Mark {o.audience === "authority" ? "authority" : "individuals"} notified
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-xs text-gray-500">
                No fixed notification deadlines derived — add affected jurisdictions/data categories to compute them.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
