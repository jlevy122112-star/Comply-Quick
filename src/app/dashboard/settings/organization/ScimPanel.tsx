"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState, Input } from "@/components/ui";
import { can, type Role } from "@/lib/rbac";
import type { ScimTokenRecord } from "@/lib/scim/tokens";
import type { ScimUserResource } from "@/lib/scim/schema";
import { createScimTokenAction, revokeScimTokenAction } from "./actions";

function fmtDate(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function ScimPanel({
  orgId,
  role,
  tokens,
  users,
  baseUrl,
  live,
}: {
  orgId: string;
  role: Role;
  tokens: ScimTokenRecord[];
  users: ScimUserResource[];
  baseUrl: string;
  live: boolean;
}) {
  const router = useRouter();
  const canManage = can(role, "scim:manage");

  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    setIssued(null);
    try {
      const res = await createScimTokenAction(orgId, name);
      if (res.ok) {
        setIssued(res.token);
        setName("");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    setBusy(id);
    try {
      await revokeScimTokenAction(orgId, id);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <div className="space-y-6">
      <div
        className={`rounded-xl border px-4 py-3 text-sm ${
          live
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
            : "border-amber-500/30 bg-amber-500/10 text-amber-200"
        }`}
      >
        {live
          ? "SCIM provisioning is active. Point your identity provider at the endpoint below and authenticate with a token."
          : "SCIM provisioning is not fully configured on this deployment. You can create tokens now; they take effect once provisioning is enabled."}
      </div>

      <Card>
        <CardBody>
          <h2 className="text-sm font-semibold text-white">Endpoint</h2>
          <p className="mt-1 text-sm text-gray-400">Use this SCIM 2.0 base URL in your identity provider.</p>
          <code className="mt-3 block break-all rounded-lg bg-gray-950 px-3 py-2 text-xs text-indigo-300">
            {baseUrl}
          </code>
          <p className="mt-2 text-xs text-gray-500">
            Provisioning and deprovisioning here mirror your directory into this organization; a deactivated user loses
            organization access. It does not create or delete Comply-Quick login accounts.
          </p>
        </CardBody>
      </Card>

      {issued && (
        <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-4 py-3">
          <p className="text-sm font-medium text-indigo-200">Copy this token now — it won&apos;t be shown again.</p>
          <code className="mt-2 block break-all rounded-lg bg-gray-950 px-3 py-2 text-xs text-indigo-300">
            {issued}
          </code>
        </div>
      )}

      {canManage && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">Create SCIM Token</h2>
            <p className="mt-1 text-sm text-gray-400">A bearer token your IdP presents on every SCIM request.</p>
            <form onSubmit={create} className="mt-4 flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Name</span>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Okta production" />
              </label>
              <Button type="submit" size="sm" disabled={busy === "new"}>
                {busy === "new" ? "Creating…" : "Create token"}
              </Button>
              {error && <span className="text-xs text-rose-400">{error}</span>}
            </form>
          </CardBody>
        </Card>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white">Tokens</h3>
        {active.length === 0 ? (
          <EmptyState
            icon="🔑"
            title="No Active Tokens"
            description="Create a token to connect your identity provider."
          />
        ) : (
          <div className="space-y-2">
            {active.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{t.name}</span>
                    <Badge tone="violet">{t.tokenPrefix}…</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    Created {fmtDate(t.createdAt)} · last used {fmtDate(t.lastUsedAt)}
                  </p>
                </div>
                {canManage && (
                  <Button size="sm" variant="ghost" disabled={busy === t.id} onClick={() => revoke(t.id)}>
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-white">Provisioned Users ({users.length})</h3>
        {users.length === 0 ? (
          <EmptyState icon="👥" title="No Provisioned Users" description="Users pushed by your IdP appear here." />
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <span className="truncate text-sm font-medium text-white">{u.displayName || u.userName}</span>
                  <p className="mt-0.5 truncate text-xs text-gray-500">{u.email ?? u.userName}</p>
                </div>
                <Badge tone={u.active ? "emerald" : "gray"}>{u.active ? "active" : "deactivated"}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
