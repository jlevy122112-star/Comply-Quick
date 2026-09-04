"use client";

import { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, CopyButton, Select } from "@/components/ui";
import type { Workspace } from "@/lib/workspaces-db";

interface ClientApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

type CmsPlatform = "webflow" | "wordpress" | "custom_html";

const CMS_INSTRUCTIONS: Record<
  CmsPlatform,
  { label: string; title: string; steps: string[]; validation: string; badge: string }
> = {
  webflow: {
    label: "Webflow",
    title: "Deploy through Project Settings",
    badge: "No-code",
    steps: [
      "Open Webflow Project Settings and select Custom Code.",
      "Paste the snippet into Head Code so it loads on every published page.",
      "Publish the site, then hard-refresh the live domain once to trigger telemetry.",
    ],
    validation: "After publish, load the live site and confirm the key shows last used in Comply-Quick.",
  },
  wordpress: {
    label: "WordPress",
    title: "Add the snippet in your global header",
    badge: "Plugin-friendly",
    steps: [
      "Paste the snippet into a header script plugin or your theme's header template.",
      "Make sure it renders before the closing </head> tag on every public page.",
      "Clear page cache/CDN cache so the latest script is served immediately.",
    ],
    validation: "Open the public site in a new tab and confirm the workspace key registers telemetry.",
  },
  custom_html: {
    label: "Custom HTML",
    title: "Ship the snippet with your deploy",
    badge: "Developer-ready",
    steps: [
      "Insert the snippet before </head> in your shared HTML layout or template.",
      "Redeploy the application so the script lands across every public route.",
      "Visit a production URL once to validate the workspace handshake.",
    ],
    validation: "Use your production URL, then return here and verify telemetry becomes active.",
  },
};

function formatDate(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function InstallationPanel({
  workspaces,
  initialWorkspaceId,
  initialKeys,
  canManage,
  hideWorkspaceSelector = false,
}: {
  workspaces: Workspace[];
  initialWorkspaceId: string | null;
  initialKeys: ClientApiKey[];
  canManage: boolean;
  hideWorkspaceSelector?: boolean;
}) {
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? workspaces[0]?.id ?? "");
  const [selectedCms, setSelectedCms] = useState<CmsPlatform>("webflow");
  const [showPlaintextKey, setShowPlaintextKey] = useState(false);
  const [keys, setKeys] = useState<ClientApiKey[]>(initialKeys);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const siteOrigin =
    (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL) ??
    "https://comply-quick.com";

  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null;
  const cms = CMS_INSTRUCTIONS[selectedCms];

  const installSnippet = useMemo(() => {
    if (!activeKey) return "";
    const normalizedOrigin = siteOrigin.endsWith("/") ? siteOrigin.slice(0, -1) : siteOrigin;
    return `<script defer src="${normalizedOrigin}/api/compliance-agent.js" data-cq-key="${activeKey}"></script>`;
  }, [activeKey, siteOrigin]);

  async function refreshKeys(showSpinner = true, workspaceOverride?: string) {
    const targetWorkspaceId = workspaceOverride ?? workspaceId;
    if (!targetWorkspaceId) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${targetWorkspaceId}/api-key`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error("Could not load API keys.");
      if (requestId === requestIdRef.current) setKeys((data.keys as ClientApiKey[]) ?? []);
    } catch {
      if (requestId === requestIdRef.current) setError("Could not load API keys.");
    } finally {
      if (showSpinner && requestId === requestIdRef.current) setLoading(false);
    }
  }

  async function createKey(rotate = false) {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/api-key`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: rotate ? "Primary install key" : "Install snippet", rotate }),
      });
      const data = await res.json();
      if (!res.ok || typeof data.key !== "string") throw new Error("Could not create API key.");
      setActiveKey(data.key);
      setShowPlaintextKey(true);
      await refreshKeys(false);
    } catch {
      setError("Could not create API key.");
    } finally {
      setLoading(false);
    }
  }

  async function revokeKey(keyId: string) {
    if (!workspaceId) return;
    setRevokingId(keyId);
    setError(null);
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/api-key?keyId=${encodeURIComponent(keyId)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not revoke API key.");
      setKeys((prev) => prev.map((key) => (key.id === keyId ? { ...key, revokedAt: new Date().toISOString() } : key)));
    } catch {
      setError("Could not revoke API key.");
    } finally {
      setRevokingId(null);
    }
  }

  const activeKeys = keys.filter((key) => !key.revokedAt);

  return (
    <div className="space-y-6">
      <Card variant="glass" blur>
        <CardHeader
          title="Workspace install snippet"
          description={
            <>
              Generate a workspace-scoped API key, inject it into the snippet, and deploy it with tenant-safe telemetry
              validation through <code className="text-indigo-300">/api/compliance-agent</code>.
            </>
          }
          actions={
            <div className="flex flex-wrap gap-2">
              <Badge tone="indigo">Workspace-bound</Badge>
              <Badge tone="emerald">Telemetry verified</Badge>
            </div>
          }
        />
        <CardBody className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              {!hideWorkspaceSelector && workspaces.length > 0 ? (
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-white">Workspace</span>
                  <Select
                    value={workspaceId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setWorkspaceId(next);
                      setActiveKey(null);
                      setShowPlaintextKey(false);
                      void refreshKeys(true, next);
                    }}
                  >
                    {workspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>
                        {workspace.name}
                      </option>
                    ))}
                  </Select>
                </label>
              ) : (
                <div className="rounded-xl border border-gray-800 bg-gray-950/60 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Workspace</p>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {activeWorkspace?.name ?? "Workspace not set"}
                  </p>
                </div>
              )}

              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Key lifecycle</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Plaintext keys are shown once. Rotate to mint a new primary key and revoke the prior active set.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void refreshKeys()}
                      loading={loading}
                    >
                      Refresh
                    </Button>
                    {canManage && (
                      <>
                        <Button type="button" size="sm" onClick={() => void createKey(false)} loading={loading}>
                          Generate key
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => void createKey(true)}
                          loading={loading}
                        >
                          Rotate key
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {showPlaintextKey && activeKey && (
                  <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-200">Copy this workspace API key now.</p>
                        <p className="mt-1 text-xs text-emerald-100/80">
                          For security, Comply-Quick will never reveal it again.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <CopyButton value={activeKey} label="Copy key" copiedLabel="Key copied!" />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowPlaintextKey(false);
                            setActiveKey(null);
                          }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                    <code className="mt-3 block overflow-x-auto rounded-xl bg-gray-950/80 p-3 text-xs text-emerald-200">
                      {activeKey}
                    </code>
                  </div>
                )}

                {activeKeys.length > 0 ? (
                  <ul className="mt-4 space-y-3">
                    {activeKeys.map((key) => (
                      <li
                        key={key.id}
                        className="flex flex-col gap-3 rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-white">{key.name}</span>
                            <Badge tone="gray">{key.keyPrefix}…</Badge>
                          </div>
                          <p className="mt-1 text-xs text-gray-400">
                            Created {formatDate(key.createdAt)} · Last used {formatDate(key.lastUsedAt)}
                          </p>
                        </div>
                        {canManage && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => void revokeKey(key.id)}
                            loading={revokingId === key.id}
                          >
                            Revoke
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-gray-700 bg-gray-950/40 px-4 py-5 text-sm text-gray-400">
                    No active workspace keys yet. Generate one to reveal a ready-to-install snippet.
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Live install snippet</p>
                    <p className="mt-1 text-xs text-gray-400">
                      The snippet is injected with the latest plaintext workspace key from this session.
                    </p>
                  </div>
                  <Badge tone="indigo">Step 1</Badge>
                </div>
                <code className="mt-3 block overflow-x-auto rounded-xl bg-gray-950/90 p-3 text-xs text-indigo-200">
                  {installSnippet || "<!-- Generate or rotate a workspace key to reveal the install snippet -->"}
                </code>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CopyButton
                    value={installSnippet}
                    label="Copy snippet"
                    copiedLabel="Snippet copied!"
                    disabled={!installSnippet}
                    onCopy={() => {
                      setShowPlaintextKey(false);
                      setActiveKey(null);
                    }}
                  />
                  <Button type="button" variant="ghost" size="sm" disabled>
                    Tenant-safe by design
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">CMS-specific guidance</p>
                    <p className="mt-1 text-xs text-gray-400">Choose the surface your team ships from most often.</p>
                  </div>
                  <Badge tone="emerald">{cms.badge}</Badge>
                </div>
                <label className="mt-4 block text-sm">
                  <span className="mb-2 block font-medium text-white">Platform</span>
                  <Select value={selectedCms} onChange={(event) => setSelectedCms(event.target.value as CmsPlatform)}>
                    {Object.entries(CMS_INSTRUCTIONS).map(([value, entry]) => (
                      <option key={value} value={value}>
                        {entry.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <div className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                  <p className="text-sm font-semibold text-white">{cms.title}</p>
                  <ol className="mt-3 space-y-2 text-sm text-gray-300">
                    {cms.steps.map((step, index) => (
                      <li key={step} className="flex gap-3">
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-xs font-semibold text-indigo-200">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                    Validation: {cms.validation}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Boundary enforcement</p>
              <p className="mt-2 text-sm text-gray-200">
                Every key is tied to one workspace and one organization only.
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Telemetry path</p>
              <p className="mt-2 text-sm text-gray-200">
                Browser events post to <code className="text-indigo-300">/api/compliance-agent</code> for validation.
              </p>
            </div>
            <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Operational safety</p>
              <p className="mt-2 text-sm text-gray-200">
                Rotate or revoke keys instantly without leaking plaintext after setup.
              </p>
            </div>
          </div>

          {workspaces.length === 0 && (
            <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-sm text-gray-300">
              No workspaces yet. Create a workspace first to generate an installation key.
            </div>
          )}
          {error && <p className="text-sm text-rose-300">{error}</p>}
        </CardBody>
      </Card>
    </div>
  );
}
