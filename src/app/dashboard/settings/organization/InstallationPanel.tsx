"use client";

import { useMemo, useRef, useState } from "react";
import type { Workspace } from "@/lib/workspaces-db";
import { CopyButton } from "@/components/ui/CopyButton";

interface ClientApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export function InstallationPanel({
  workspaces,
  initialWorkspaceId,
  initialKeys,
  canManage,
}: {
  workspaces: Workspace[];
  initialWorkspaceId: string | null;
  initialKeys: ClientApiKey[];
  canManage: boolean;
}) {
  const [workspaceId, setWorkspaceId] = useState(initialWorkspaceId ?? workspaces[0]?.id ?? "");
  const [showPlaintextKey, setShowPlaintextKey] = useState(false);
  const [keys, setKeys] = useState<ClientApiKey[]>(initialKeys);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const siteOrigin =
    (typeof window !== "undefined" ? window.location.origin : process.env.NEXT_PUBLIC_SITE_URL) ??
    "https://comply-quick.com";

  const installSnippet = useMemo(() => {
    if (!activeKey) return "";
    const normalizedOrigin = siteOrigin.endsWith("/") ? siteOrigin.slice(0, -1) : siteOrigin;
    return `<script defer src="${normalizedOrigin}/api/compliance-agent.js" data-cq-key="${activeKey}"></script>`;
  }, [activeKey, siteOrigin]);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId) ?? null;

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
      if (requestId === requestIdRef.current) {
        setKeys((data.keys as ClientApiKey[]) ?? []);
      }
    } catch {
      if (requestId === requestIdRef.current) {
        setError("Could not load API keys.");
      }
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
        body: JSON.stringify({ name: "Installation", rotate }),
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

  return (
    <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Installation</h2>
          <p className="mt-1 text-sm text-gray-400">
            Install the compliance agent for{" "}
            <span className="text-gray-200">{activeWorkspace?.name ?? "a workspace"}</span>.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void refreshKeys()}
            className="rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-200 hover:border-gray-500"
          >
            Refresh
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => void createKey(false)}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                Generate key
              </button>
              <button
                type="button"
                onClick={() => void createKey(true)}
                disabled={loading}
                className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-semibold text-amber-300 hover:border-amber-400 disabled:opacity-60"
              >
                Rotate key
              </button>
            </>
          )}
        </div>
      </div>

      {activeKey && showPlaintextKey && (
        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-300">Copy this key now — it will not be shown again.</p>
          <code className="mt-2 block overflow-x-auto rounded-lg bg-gray-950/70 p-3 text-xs text-emerald-200">
            {activeKey}
          </code>
          <button
            type="button"
            onClick={() => {
              setShowPlaintextKey(false);
              setActiveKey(null);
            }}
            className="mt-3 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:border-gray-500"
          >
            Dismiss key
          </button>
        </div>
      )}

      {workspaces.length > 0 ? (
        <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
          <label htmlFor="installation-workspace" className="mb-2 block text-sm font-medium text-white">
            Workspace
          </label>
          <select
            id="installation-workspace"
            value={workspaceId}
            onChange={(event) => {
              const next = event.target.value;
              setWorkspaceId(next);
              setActiveKey(null);
              setShowPlaintextKey(false);
              void refreshKeys(true, next);
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 focus:border-indigo-500 focus:outline-none"
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-gray-800 bg-gray-950/60 p-4 text-sm text-gray-300">
          No workspaces yet. Create a workspace first to generate an installation key.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-gray-800 bg-gray-950/60 p-4">
        <p className="text-sm font-medium text-white">Install snippet</p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-gray-950 p-3 text-xs text-gray-200">
          {installSnippet || "<!-- Generate an API key to reveal your snippet -->"}
        </code>
        {installSnippet && (
          <div className="mt-3">
            <CopyButton
              value={installSnippet}
              label="Copy snippet"
              copiedLabel="Snippet copied!"
              onCopy={() => {
                setShowPlaintextKey(false);
                setActiveKey(null);
              }}
            />
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-4 text-xs text-gray-300 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
          <p className="font-semibold text-white">Webflow</p>
          <p className="mt-1">Project Settings → Custom Code → Head Code.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
          <p className="font-semibold text-white">WordPress</p>
          <p className="mt-1">Insert via header script plugin or theme header.</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-3">
          <p className="font-semibold text-white">Custom Sites</p>
          <p className="mt-1">Add before closing {"</head>"} and redeploy.</p>
        </div>
      </div>

      {keys.length > 0 && (
        <ul className="mt-5 divide-y divide-gray-800 rounded-xl border border-gray-800 bg-gray-950/40">
          {keys.map((key) => (
            <li key={key.id} className="px-4 py-3 text-xs text-gray-300">
              <span className="font-semibold text-gray-100">{key.name}</span> · {key.keyPrefix}… ·{" "}
              {key.revokedAt
                ? "revoked"
                : key.lastUsedAt
                  ? `last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                  : "never used"}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
    </section>
  );
}
