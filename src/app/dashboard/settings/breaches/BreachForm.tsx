"use client";

import { useState } from "react";
import type { BreachSeverity } from "@/lib/privacy/breach";

const SEVERITIES: BreachSeverity[] = ["low", "medium", "high", "critical"];

interface Props {
  regionOptions: { id: string; name: string }[];
  dataCategoryOptions: string[];
  busy: boolean;
  /** Submits the payload; resolves true on success so the form can reset. */
  onSubmit: (payload: Record<string, unknown>) => Promise<boolean>;
}

export function BreachForm({ regionOptions, dataCategoryOptions, busy, onSubmit }: Props) {
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

  function reset() {
    setTitle("");
    setDescription("");
    setAffected("0");
    setRegions([]);
    setCategories([]);
    setHighRisk(false);
    setSeverity("medium");
    setDiscoveredAt(new Date().toISOString().slice(0, 16));
  }

  async function handleSubmit() {
    const ok = await onSubmit({
      title,
      severity,
      // datetime-local is UTC-naive; treat the entered value as UTC.
      discoveredAt: new Date(`${discoveredAt.length === 16 ? `${discoveredAt}:00` : discoveredAt}Z`).toISOString(),
      affectedIndividuals: Number(affected) || 0,
      highRisk,
      regions,
      dataCategories: categories,
      description: description || null,
    });
    if (ok) reset();
  }

  return (
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
        onClick={handleSubmit}
        disabled={busy || !title.trim() || !discoveredAt}
        className="mt-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Record Incident"}
      </button>
    </section>
  );
}
