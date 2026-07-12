"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IncidentView } from "./page";
import { BreachForm } from "./BreachForm";
import { IncidentCard } from "./IncidentCard";

interface Props {
  views: IncidentView[];
  loadError?: string | null;
  regionOptions: { id: string; name: string }[];
  dataCategoryOptions: string[];
}

export function BreachPanel({ views, loadError, regionOptions, dataCategoryOptions }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(views.length === 0);

  async function submit(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/privacy/breaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Could not record the breach.");
      }
      setShowForm(false);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the breach.");
      return false;
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
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? "Could not update the incident.");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the incident.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {loadError && (
        <p className="rounded-md border border-red-800/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {loadError} Existing incidents could not be shown — retry shortly rather than assuming the register is empty.
        </p>
      )}

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
        <BreachForm
          regionOptions={regionOptions}
          dataCategoryOptions={dataCategoryOptions}
          busy={busy}
          onSubmit={submit}
        />
      )}

      {views.length === 0 && !showForm && !loadError && (
        <p className="text-sm text-gray-500">No breach incidents recorded.</p>
      )}

      <div className="space-y-6">
        {views.map((view) => (
          <IncidentCard key={view.incident.id} view={view} busy={busy} onPatch={patch} />
        ))}
      </div>
    </div>
  );
}
