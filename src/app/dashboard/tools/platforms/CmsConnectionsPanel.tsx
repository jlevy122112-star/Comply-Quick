"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, CardHeader } from "@/components/ui";
import type { NativeIntegration, NativeIntegrationStatus, NativePlatform } from "@/lib/native-integrations-db";
import type { Workspace } from "@/lib/workspaces-db";
import { Input, Select } from "@/components/ui/Field";
import { connectCmsIntegrationAction, disconnectCmsIntegrationAction } from "./actions";

function statusClass(status: NativeIntegrationStatus): string {
  if (status === "active") return "bg-green-900/40 text-green-300";
  if (status === "pending") return "bg-yellow-900/40 text-yellow-300";
  if (status === "degraded") return "bg-amber-900/40 text-amber-300";
  return "bg-gray-800 text-gray-300";
}

const INSTRUCTIONS: Record<NativePlatform, string[]> = {
  wordpress: [
    "Install and activate the Comply-Quick WordPress plugin.",
    "Add your workspace snippet/API key in Settings > Comply-Quick.",
    "Load any public page once to trigger sync telemetry.",
  ],
  webflow: [
    "Install the Comply-Quick Webflow app and connect your site id.",
    "Publish the snippet from Project settings > Custom code.",
    "Visit the published site once to confirm activation.",
  ],
};

export default function CmsConnectionsPanel({
  connections,
  workspaces,
  clients,
  canManage,
}: {
  connections: NativeIntegration[];
  workspaces: Workspace[];
  clients: Array<{ id: string; name: string }>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [platform, setPlatform] = useState<NativePlatform>("wordpress");
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [clientSeatId, setClientSeatId] = useState("all");
  const [externalAccountId, setExternalAccountId] = useState("");

  const instructions = useMemo(() => INSTRUCTIONS[platform], [platform]);

  function refresh() {
    startTransition(() => router.refresh());
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!externalAccountId.trim() || !workspaceId) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await connectCmsIntegrationAction({
        workspaceId,
        clientSeatId: clientSeatId === "all" ? null : clientSeatId,
        platform,
        externalAccountId: externalAccountId.trim(),
      });
      if (!result.ok) setError(result.error);
      else setExternalAccountId("");
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function disconnect(id: string) {
    setError(null);
    const result = await disconnectCmsIntegrationAction(id);
    if (!result.ok) setError(result.error);
    refresh();
  }

  return (
    <Card className="mt-8">
      <CardHeader
        title="CMS Plugin Connections"
        description="First-class native CMS integrations (Webflow + WordPress) with workspace/client-seat scoping."
      />
      <CardBody>
        {canManage && (
          <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select label="Platform" value={platform} onChange={(e) => setPlatform(e.target.value as NativePlatform)}>
                <option value="wordpress">WordPress</option>
                <option value="webflow">Webflow</option>
              </Select>
              <Select label="Workspace" value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)}>
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </option>
                ))}
              </Select>
              <Select label="Client seat" value={clientSeatId} onChange={(e) => setClientSeatId(e.target.value)}>
                <option value="all">Agency-wide</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </Select>
              <Input
                label="Site / Account Identifier"
                placeholder="example.com or site id"
                value={externalAccountId}
                onChange={(e) => setExternalAccountId(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={submitting || isPending || !externalAccountId.trim() || !workspaceId}>
                {submitting ? "Connecting..." : "Connect native integration"}
              </Button>
              <Badge tone="indigo">Soft-revoke on disconnect</Badge>
            </div>
          </form>
        )}

        <div className="mb-6 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">{platform} install instructions</p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-gray-300">
            {instructions.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-emerald-300">
            Post-install verification: open a public page and confirm telemetry through /api/compliance-agent.
          </p>
        </div>

        {!canManage && (
          <p className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Only owners and admins can connect/disconnect native CMS integrations.
          </p>
        )}
        {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

        {connections.length === 0 ? (
          <p className="text-sm text-gray-500">No native CMS connections yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="border-b border-gray-700 text-gray-400">
                <tr>
                  <th className="pb-2">Platform</th>
                  <th className="pb-2">Identifier</th>
                  <th className="pb-2">Workspace</th>
                  <th className="pb-2">Client seat</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Connected</th>
                  <th className="pb-2">Action</th>
                </tr>
              </thead>
              <tbody className="text-gray-200">
                {connections.map((c) => (
                  <tr key={c.id} className="border-b border-gray-800 last:border-0">
                    <td className="py-3 capitalize">{c.platform}</td>
                    <td className="py-3">{c.externalAccountId}</td>
                    <td className="py-3">{workspaces.find((w) => w.id === c.workspaceId)?.name ?? "—"}</td>
                    <td className="py-3">{clients.find((client) => client.id === c.clientSeatId)?.name ?? "Agency-wide"}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${statusClass(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">{new Date(c.connectedAt).toLocaleDateString()}</td>
                    <td className="py-3">
                      {canManage && c.status !== "revoked" ? (
                        <Button variant="ghost" size="sm" onClick={() => void disconnect(c.id)}>
                          Disconnect
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
