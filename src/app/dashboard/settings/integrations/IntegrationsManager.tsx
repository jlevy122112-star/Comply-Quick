"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";
import type { Integration, IntegrationKind } from "@/lib/integrations-db";
import { addIntegrationAction, setIntegrationActiveAction, deleteIntegrationAction } from "./actions";

const KIND_LABEL: Record<IntegrationKind, string> = {
  webhook: "Generic webhook",
};

// Tolerate rows whose stored kind predates the current type (e.g. legacy `slack`
// rows still present until the cleanup migration runs) so the UI never renders
// `undefined` for them.
function kindLabel(kind: string): string {
  return KIND_LABEL[kind as IntegrationKind] ?? kind;
}

export function IntegrationsManager({ integrations, canManage }: { integrations: Integration[]; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<IntegrationKind>("webhook");
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  const disabled = busyId !== null || isPending;

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new");
    try {
      const res = await addIntegrationAction({ kind, name, targetUrl });
      if (res.ok) {
        setName("");
        setTargetUrl("");
        refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggle(i: Integration) {
    setBusyId(i.id);
    try {
      await setIntegrationActiveAction(i.id, !i.active);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await deleteIntegrationAction(id);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {canManage && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">Connect an endpoint</h2>
            <p className="mt-1 text-sm text-gray-400">
              Deliver Comply-Quick events (new alerts, approvals, findings) to an external system.
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Type</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as IntegrationKind)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="webhook">Generic webhook</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Ops webhook"
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <label className="flex-1 text-sm">
                <span className="mb-1 block text-gray-400">Target URL (https)</span>
                <input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://hooks.example.com/…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <Button type="submit" size="sm" disabled={disabled}>
                {busyId === "new" ? "Saving…" : "Add"}
              </Button>
            </form>
            {error && (
              <p className="mt-2 text-xs text-rose-400" role="alert" aria-live="polite">
                {error}
              </p>
            )}
          </CardBody>
        </Card>
      )}
      {!canManage && (
        <p
          className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
          role="status"
        >
          Only owners and admins can manage integrations for this organization.
        </p>
      )}

      {integrations.length === 0 ? (
        <EmptyState
          icon="🔌"
          title="No integrations yet"
          description="Add a webhook endpoint above to start receiving event notifications."
        />
      ) : (
        <div className="space-y-2">
          {integrations.map((i) => (
            <div
              key={i.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">{i.name}</span>
                  <Badge tone={i.active ? "emerald" : "gray"}>{i.active ? "active" : "paused"}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">
                  {kindLabel(i.kind)} · {i.targetUrl}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" disabled={disabled} onClick={() => toggle(i)}>
                  {i.active ? "Pause" : "Resume"}
                </Button>
                <Button size="sm" variant="ghost" disabled={disabled} onClick={() => remove(i.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
