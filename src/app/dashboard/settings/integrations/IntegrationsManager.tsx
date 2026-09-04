"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState } from "@/components/ui";
import type { Integration, IntegrationKind } from "@/lib/integrations-db";
import type { NativeIntegration, NativeIntegrationStatus, NativePlatform } from "@/lib/native-integrations-db";
import type { Workspace } from "@/lib/workspaces-db";
import {
  addIntegrationAction,
  connectNativeIntegrationAction,
  deleteIntegrationAction,
  disconnectNativeIntegrationAction,
  setIntegrationActiveAction,
} from "./actions";

const KIND_LABEL: Record<IntegrationKind, string> = {
  webhook: "Generic Webhook",
};

const NATIVE_STATUS_LABEL: Record<NativeIntegrationStatus, string> = {
  pending: "Pending",
  active: "Active",
  degraded: "Needs Attention",
  revoked: "Disconnected",
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind as IntegrationKind] ?? kind;
}

function statusTone(status: NativeIntegrationStatus): "emerald" | "amber" | "gray" {
  if (status === "active") return "emerald";
  if (status === "pending" || status === "degraded") return "amber";
  return "gray";
}

function platformLabel(platform: NativePlatform): string {
  return platform === "webflow" ? "Webflow" : "WordPress";
}

const CMS_INSTRUCTIONS: Record<NativePlatform, string[]> = {
  webflow: [
    "Install the Comply-Quick Webflow app and connect this account/site identifier.",
    "In Webflow Project Settings > Custom Code, publish the generated install snippet.",
    "Republish the project, then visit the live URL once to trigger verification telemetry.",
  ],
  wordpress: [
    "Install and activate the Comply-Quick WordPress plugin.",
    "Paste your workspace install snippet in Settings > Comply-Quick and save.",
    "Open a public page and confirm telemetry activity to move the integration to active.",
  ],
};

export function IntegrationsManager({
  integrations,
  nativeIntegrations,
  workspaces,
  clients,
  canManage,
}: {
  integrations: Integration[];
  nativeIntegrations: NativeIntegration[];
  workspaces: Workspace[];
  clients: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [kind, setKind] = useState<IntegrationKind>("webhook");
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  const [nativePlatform, setNativePlatform] = useState<NativePlatform>("wordpress");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [clientSeatId, setClientSeatId] = useState<string>("all");
  const [nativeAccountId, setNativeAccountId] = useState("");

  const [platformFilter, setPlatformFilter] = useState<NativePlatform | "all">("all");
  const [statusFilter, setStatusFilter] = useState<NativeIntegrationStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [attentionOnly, setAttentionOnly] = useState(false);

  const disabled = busyId !== null || isPending;

  const filteredNative = useMemo(
    () =>
      nativeIntegrations.filter((item) => {
        if (platformFilter !== "all" && item.platform !== platformFilter) return false;
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (clientFilter !== "all" && (item.clientSeatId ?? "none") !== clientFilter) return false;
        if (attentionOnly && item.status !== "degraded" && item.status !== "revoked") return false;
        return true;
      }),
    [attentionOnly, clientFilter, nativeIntegrations, platformFilter, statusFilter]
  );

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function submitWebhook(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new-webhook");
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

  async function submitNative(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusyId("new-native");
    try {
      const res = await connectNativeIntegrationAction({
        workspaceId,
        clientSeatId: clientSeatId === "all" ? null : clientSeatId,
        platform: nativePlatform,
        externalAccountId: nativeAccountId,
      });
      if (res.ok) {
        setNativeAccountId("");
        refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function disconnectNative(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await disconnectNativeIntegrationAction(id, "Disconnected by organization admin");
      if (!res.ok) setError(res.error);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleWebhook(i: Integration) {
    setBusyId(i.id);
    try {
      await setIntegrationActiveAction(i.id, !i.active);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function removeWebhook(id: string) {
    setBusyId(id);
    try {
      await deleteIntegrationAction(id);
      refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">First-Class Integrations</h2>
            <Badge tone="indigo">Native CMS</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Connect Webflow and WordPress at workspace + client-seat scope with tenant-safe lifecycle tracking.
          </p>

          {canManage && (
            <form onSubmit={submitNative} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Platform</span>
                <select
                  value={nativePlatform}
                  onChange={(e) => setNativePlatform(e.target.value as NativePlatform)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="wordpress">WordPress</option>
                  <option value="webflow">Webflow</option>
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Workspace</span>
                <select
                  value={workspaceId}
                  onChange={(e) => setWorkspaceId(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Client seat</span>
                <select
                  value={clientSeatId}
                  onChange={(e) => setClientSeatId(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="all">Agency-wide</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm lg:col-span-2">
                <span className="mb-1 block text-gray-400">Site / account identifier</span>
                <input
                  value={nativeAccountId}
                  onChange={(e) => setNativeAccountId(e.target.value)}
                  placeholder={nativePlatform === "webflow" ? "Webflow site id" : "example.com"}
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white placeholder:text-gray-600 focus:border-indigo-500 focus:outline-none"
                />
              </label>
              <div className="lg:col-span-5">
                <Button type="submit" size="sm" disabled={disabled || !workspaceId || !nativeAccountId.trim()}>
                  {busyId === "new-native" ? "Connecting…" : "Connect native integration"}
                </Button>
              </div>
            </form>
          )}

          {!canManage && (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              Only owners and admins can connect or disconnect native integrations.
            </p>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              <span className="mb-1 block text-gray-400">Platform filter</span>
              <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value as NativePlatform | "all")}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All platforms</option>
                <option value="webflow">Webflow</option>
                <option value="wordpress">WordPress</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-400">Status filter</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as NativeIntegrationStatus | "all")}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="degraded">Needs attention</option>
                <option value="revoked">Disconnected</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-400">Client filter</span>
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">All client seats</option>
                <option value="none">Agency-wide</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end rounded-lg border border-gray-800 px-3 py-2 text-sm text-gray-300">
              <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
              Attention needed only
            </label>
          </div>

          {filteredNative.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon="🧩"
                title="No native CMS connections"
                description="Connect Webflow or WordPress above to enable sync, remediation, and lifecycle management."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {filteredNative.map((i) => (
                <div
                  key={i.id}
                  className="rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
                  data-testid={`native-integration-${i.id}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{platformLabel(i.platform)}</span>
                        <Badge tone={statusTone(i.status)}>{NATIVE_STATUS_LABEL[i.status]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {i.externalAccountId} · Workspace {i.workspaceId ?? "Unscoped"} · Client{" "}
                        {clients.find((c) => c.id === i.clientSeatId)?.name ?? (i.clientSeatId ? i.clientSeatId : "Agency-wide")}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Last verified {i.lastVerifiedAt ? new Date(i.lastVerifiedAt).toLocaleString() : "not yet"} · Last sync{" "}
                        {i.lastSyncAt ? new Date(i.lastSyncAt).toLocaleString() : "not yet"}
                      </p>
                    </div>
                    {canManage && i.status !== "revoked" ? (
                      <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void disconnectNative(i.id)}>
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 p-3">
                    <p className="text-xs font-semibold text-gray-300">Installation guidance ({platformLabel(i.platform)})</p>
                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-gray-400">
                      {CMS_INSTRUCTIONS[i.platform].map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Advanced / Custom Integrations</h2>
            <Badge tone="gray">Generic Webhook</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Route Comply-Quick events to custom CMS pipelines and enterprise systems.
          </p>

          {canManage && (
            <form onSubmit={submitWebhook} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Type</span>
                <select
                  value={kind}
                  onChange={(e) => setKind(e.target.value as IntegrationKind)}
                  className="rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="webhook">Generic Webhook</option>
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
                {busyId === "new-webhook" ? "Saving…" : "Add"}
              </Button>
            </form>
          )}
          {error && (
            <p className="mt-2 text-xs text-rose-400" role="alert" aria-live="polite">
              {error}
            </p>
          )}
          {!canManage && (
            <p
              className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
              role="status"
            >
              Only owners and admins can manage integrations for this organization.
            </p>
          )}

          {integrations.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                icon="🔌"
                title="No Advanced Integrations Yet"
                description="Add a generic webhook endpoint to start receiving event notifications."
              />
            </div>
          ) : (
            <div className="mt-6 space-y-2">
              {integrations.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-white">{i.name}</span>
                      <Badge tone={i.active ? "emerald" : "gray"}>{i.active ? "Active" : "Paused"}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {kindLabel(i.kind)} · {i.targetUrl}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="secondary" disabled={disabled} onClick={() => void toggleWebhook(i)}>
                      {i.active ? "Pause" : "Resume"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void removeWebhook(i.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
