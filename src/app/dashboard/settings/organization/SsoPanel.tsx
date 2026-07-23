"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, EmptyState, Input, Select } from "@/components/ui";
import { can, type Role } from "@/lib/rbac";
import type { SsoConnection, SsoProtocol } from "@/lib/sso-db";
import { createSsoAction, setSsoEnabledAction, deleteSsoAction } from "./actions";

export function SsoPanel({
  orgId,
  role,
  connections,
  live,
}: {
  orgId: string;
  role: Role;
  connections: SsoConnection[];
  live: boolean;
}) {
  const router = useRouter();
  const canManage = can(role, "sso:manage");

  const [displayName, setDisplayName] = useState("");
  const [protocol, setProtocol] = useState<SsoProtocol>("saml");
  const [emailDomain, setEmailDomain] = useState("");
  const [metadataUrl, setMetadataUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("new");
    setError(null);
    try {
      const res = await createSsoAction(orgId, { displayName, protocol, emailDomain, metadataUrl });
      if (res.ok) {
        setDisplayName("");
        setEmailDomain("");
        setMetadataUrl("");
        router.refresh();
      } else {
        setError(res.error);
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggle(c: SsoConnection) {
    setBusy(c.id);
    try {
      await setSsoEnabledAction(orgId, c.id, !c.enabled);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(c: SsoConnection) {
    setBusy(c.id);
    try {
      await deleteSsoAction(orgId, c.id);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

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
          ? "SSO handoff is configured for this deployment. Enabled connections route matching email domains to your IdP."
          : "SSO handoff is not yet wired at the auth layer. You can configure connections now; they take effect once the provider is connected."}
      </div>

      {canManage && (
        <Card>
          <CardBody>
            <h2 className="text-sm font-semibold text-white">Add SSO Connection</h2>
            <p className="mt-1 text-sm text-gray-400">Map an email domain to your identity provider (SAML or OIDC).</p>
            <form onSubmit={create} className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Display name</span>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Acme Okta" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Protocol</span>
                <Select value={protocol} onChange={(e) => setProtocol(e.target.value as SsoProtocol)}>
                  <option value="saml">SAML 2.0</option>
                  <option value="oidc">OIDC</option>
                </Select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Email domain</span>
                <Input value={emailDomain} onChange={(e) => setEmailDomain(e.target.value)} placeholder="acme.com" />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-gray-400">Metadata URL (optional)</span>
                <Input
                  value={metadataUrl}
                  onChange={(e) => setMetadataUrl(e.target.value)}
                  placeholder="https://idp.acme.com/metadata"
                />
              </label>
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" disabled={busy === "new"}>
                  {busy === "new" ? "Saving…" : "Add connection"}
                </Button>
                {error && <span className="ml-3 text-xs text-rose-400">{error}</span>}
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {connections.length === 0 ? (
        <EmptyState
          icon="🔐"
          title="No SSO Connections"
          description="Add a SAML or OIDC connection to let your team sign in with your identity provider."
        />
      ) : (
        <div className="space-y-2">
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-white">{c.displayName}</span>
                  <Badge tone={c.enabled ? "emerald" : "gray"}>{c.enabled ? "enabled" : "disabled"}</Badge>
                  <Badge tone="violet">{c.protocol.toUpperCase()}</Badge>
                </div>
                <p className="mt-0.5 truncate text-xs text-gray-500">{c.emailDomain}</p>
              </div>
              {canManage && (
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" disabled={busy === c.id} onClick={() => toggle(c)}>
                    {c.enabled ? "Disable" : "Enable"}
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => remove(c)}>
                    Delete
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
