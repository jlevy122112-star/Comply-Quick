"use client";

import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Input, Skeleton } from "@/components/ui";

type Connection = {
  id: string;
  installationId: number;
  targetType: "user" | "organization" | "repository";
  targetLogin: string | null;
  repositorySelection: "all" | "selected";
  connectedAt: string;
  lastVerifiedAt: string | null;
  lastWebhookAt: string | null;
};

type RecentScan = {
  id: string;
  repoFullName: string;
  refName: string | null;
  headSha: string | null;
  enqueueSource: "manual" | "push";
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  findingsCount: number | null;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

type PushEvent = {
  id: string;
  repoFullName: string;
  refName: string | null;
  afterSha: string | null;
  senderLogin: string | null;
  createdAt: string;
};

type ApiPayload = {
  connected?: boolean;
  repos?: string[];
  connection?: Connection;
  recentScans?: RecentScan[];
  recentPushEvents?: PushEvent[];
  error?: string;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

function shortSha(value: string | null | undefined): string {
  return value ? value.slice(0, 7) : "—";
}

function statusTone(status: RecentScan["status"]): "gray" | "indigo" | "emerald" | "rose" {
  if (status === "queued") return "gray";
  if (status === "running") return "indigo";
  if (status === "succeeded") return "emerald";
  return "rose";
}

export default function GitHubIntegrationTool() {
  const [connected, setConnected] = useState(false);
  const [repos, setRepos] = useState<string[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [recentPushEvents, setRecentPushEvents] = useState<PushEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [repoFlowName, setRepoFlowName] = useState("");
  const [repoFlowId, setRepoFlowId] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [scanning, setScanning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/github/repos", { cache: "no-store" });
      const json = (await res.json()) as ApiPayload;
      if (!res.ok || json.error) {
        setError(json.error ?? "Could not load GitHub App status.");
      } else {
        setConnected(Boolean(json.connected));
        setRepos(json.repos ?? []);
        setConnection(json.connection ?? null);
        setRecentScans(json.recentScans ?? []);
        setRecentPushEvents(json.recentPushEvents ?? []);
      }
    } catch {
      setError("Could not load GitHub App status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchStatus();
  }, [fetchStatus]);

  const metrics = useMemo(() => {
    const queued = recentScans.filter((scan) => scan.status === "queued").length;
    const running = recentScans.filter((scan) => scan.status === "running").length;
    const failed = recentScans.filter((scan) => scan.status === "failed").length;
    return { queued, running, failed };
  }, [recentScans]);

  async function queueManualScan(event: FormEvent) {
    event.preventDefault();
    if (!selectedRepo.trim()) return;
    setScanning(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/github/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoFullName: selectedRepo.trim() }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not queue scan.");
      } else {
        setMessage(json.message ?? "Scan queued.");
        await fetchStatus();
      }
    } catch {
      setError("Could not queue scan.");
    } finally {
      setScanning(false);
    }
  }

  const repoInstallHref = `/api/github/auth?flow=repo${repoFlowName.trim() ? `&repo=${encodeURIComponent(repoFlowName.trim())}` : ""}${repoFlowId.trim() ? `&repositoryId=${encodeURIComponent(repoFlowId.trim())}` : ""}`;
  const orgInstallHref = "/api/github/auth?flow=org";

  return (
    <div className="space-y-6">
      <Card variant="glass" blur>
        <CardHeader
          title="GitHub App monitoring"
          description="Install the Comply-Quick GitHub App with fine-grained read-only code access, ingest push events, and monitor compliance scans from one enterprise control plane."
          actions={
            <div className="flex flex-wrap gap-2">
              <Badge tone="indigo">GitHub App</Badge>
              <Badge tone="emerald">Read-only code</Badge>
              <Badge tone="sky">Push-triggered</Badge>
            </div>
          }
        />
        <CardBody className="space-y-6">
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Installation</p>
                <p className="mt-2 text-2xl font-semibold text-white">{connected ? "Active" : "Pending"}</p>
                <p className="mt-1 text-sm text-gray-400">
                  {connected ? `Install #${connection?.installationId}` : "No GitHub App installation connected yet."}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Accessible repos</p>
                <p className="mt-2 text-2xl font-semibold text-white">{repos.length}</p>
                <p className="mt-1 text-sm text-gray-400">
                  {connection?.repositorySelection === "all"
                    ? "Organization-wide coverage"
                    : "Selected repositories only"}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Queue health</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metrics.queued + metrics.running}</p>
                <p className="mt-1 text-sm text-gray-400">
                  {metrics.running} running · {metrics.failed} failed
                </p>
              </div>
              <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Latest webhook</p>
                <p className="mt-2 text-sm font-semibold text-white">{formatDate(connection?.lastWebhookAt)}</p>
                <p className="mt-1 text-sm text-gray-400">Last verification {formatDate(connection?.lastVerifiedAt)}</p>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-rose-300">{error}</p>}
          {message && <p className="text-sm text-emerald-300">{message}</p>}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Organization install flow</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Launch a broad installation and choose all repositories to establish enterprise-wide monitoring
                    coverage.
                  </p>
                </div>
                <Badge tone="indigo">All repos</Badge>
              </div>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-gray-300">
                <li>Open the GitHub install screen.</li>
                <li>Select the target organization.</li>
                <li>Grant metadata + contents read-only permissions and choose all repositories.</li>
              </ol>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => (window.location.href = orgInstallHref)}>Install for organization</Button>
                <Button variant="secondary" onClick={() => void fetchStatus()} disabled={loading}>
                  Refresh status
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-950/70 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Repository install flow</p>
                  <p className="mt-1 text-sm text-gray-400">
                    Pre-stage a targeted install for a sensitive repository. Add an optional repository id to deep-link
                    the GitHub selected-repository flow.
                  </p>
                </div>
                <Badge tone="sky">Selected repos</Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Input
                  label="Repository (optional)"
                  placeholder="owner/repo"
                  value={repoFlowName}
                  onChange={(event) => setRepoFlowName(event.target.value)}
                />
                <Input
                  label="Repository id (optional)"
                  placeholder="123456789"
                  value={repoFlowId}
                  onChange={(event) => setRepoFlowId(event.target.value)}
                />
              </div>
              <p className="mt-3 text-xs text-gray-500">
                If you skip the repository id, GitHub still lets the installer choose specific repositories during
                setup.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => (window.location.href = repoInstallHref)}>
                  Install for repository
                </Button>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {connected ? (
        <>
          <Card variant="glass" blur>
            <CardHeader
              title="Connected installation"
              description="Operational profile for the active GitHub App installation."
              actions={<Badge tone="emerald">{connection?.targetType ?? "organization"}</Badge>}
            />
            <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Target</p>
                <p className="mt-2 text-sm font-semibold text-white">{connection?.targetLogin ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Repository scope</p>
                <p className="mt-2 text-sm font-semibold text-white">
                  {connection?.repositorySelection === "all" ? "All repositories" : "Selected repositories"}
                </p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Connected</p>
                <p className="mt-2 text-sm font-semibold text-white">{formatDate(connection?.connectedAt)}</p>
              </div>
              <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-gray-500">Permissions</p>
                <p className="mt-2 text-sm font-semibold text-white">metadata:read · contents:read</p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Queue a compliance scan"
              description="Kick off an on-demand repository scan while push webhooks handle continuous monitoring."
            />
            <CardBody>
              <form onSubmit={queueManualScan} className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex-1">
                  <Input
                    label="Repository"
                    placeholder="owner/repo"
                    value={selectedRepo}
                    onChange={(event) => setSelectedRepo(event.target.value)}
                    list="github-repos"
                  />
                  <datalist id="github-repos">
                    {repos.map((repo) => (
                      <option key={repo} value={repo} />
                    ))}
                  </datalist>
                </div>
                <Button type="submit" loading={scanning} disabled={!selectedRepo.trim()}>
                  Queue scan
                </Button>
              </form>
            </CardBody>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <Card>
              <CardHeader
                title="github_scan_queue"
                description="Live view of async compliance scans created manually or from push webhooks."
              />
              <CardBody>
                {recentScans.length === 0 ? (
                  <EmptyState
                    icon="🛰️"
                    title="No scans queued yet"
                    description="Webhook-triggered and manual scans will appear here with worker execution status."
                  />
                ) : (
                  <div className="space-y-3">
                    {recentScans.map((scan) => (
                      <div key={scan.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-white">{scan.repoFullName}</p>
                              <Badge tone={statusTone(scan.status)}>{scan.status}</Badge>
                              <Badge tone="gray">{scan.enqueueSource}</Badge>
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              Ref {scan.refName ?? "—"} · Commit {shortSha(scan.headSha)} · Attempts {scan.attempts}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>Queued {formatDate(scan.queuedAt)}</p>
                            <p>Finished {formatDate(scan.finishedAt)}</p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
                          <span>Findings {scan.findingsCount ?? "—"}</span>
                          <span>Started {formatDate(scan.startedAt)}</span>
                          {scan.lastError ? <span className="text-rose-300">Error: {scan.lastError}</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent push webhooks"
                description="Delivery audit for GitHub push events accepted by Comply-Quick."
              />
              <CardBody>
                {recentPushEvents.length === 0 ? (
                  <EmptyState
                    icon="📬"
                    title="No push events yet"
                    description="After installation, every accepted push webhook appears here with repo, ref, and commit metadata."
                  />
                ) : (
                  <div className="space-y-3">
                    {recentPushEvents.map((event) => (
                      <div key={event.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{event.repoFullName}</p>
                            <p className="mt-1 text-xs text-gray-400">
                              {event.refName ?? "—"} · {shortSha(event.afterSha)} · {event.senderLogin ?? "system"}
                            </p>
                          </div>
                          <Badge tone="sky">push</Badge>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">Received {formatDate(event.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}
