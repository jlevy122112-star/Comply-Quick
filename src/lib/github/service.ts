import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInstallationAccessToken, listInstallationRepositories } from "./app-service";
import { parseRepo, type RepoFinding, type RepoFile } from "./parser";

const MAX_FILE_BYTES = 100 * 1024;
const MAX_FILES = 75;
const GITHUB_API_URL = "https://api.github.com";
const ALLOWED_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".html",
  ".vue",
  ".php",
  ".py",
  ".rb",
  ".go",
]);

export interface GitHubConnection {
  id: string;
  organizationId: string;
  externalAccountId: string;
  installationId: number;
  targetType: "user" | "organization" | "repository";
  targetLogin: string | null;
  repositorySelection: "all" | "selected";
  connectedAt: string;
  lastVerifiedAt: string | null;
  lastWebhookAt: string | null;
  installMetadata: Record<string, unknown>;
}

export interface GitHubPushEvent {
  id: string;
  repoFullName: string;
  refName: string | null;
  afterSha: string | null;
  senderLogin: string | null;
  createdAt: string;
}

export interface GitHubScanQueueItem {
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
}

interface ConnectionRow {
  id: string;
  agency_org_id: string;
  external_account_id: string;
  github_installation_id: number;
  github_installation_target_type: "user" | "organization" | "repository" | null;
  github_installation_target_login: string | null;
  github_repository_selection: "all" | "selected" | null;
  created_at: string;
  last_verified_at: string | null;
  last_webhook_at: string | null;
  install_metadata: Record<string, unknown> | null;
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
  sha?: string;
}

interface QueueRow {
  id: string;
  repo_full_name: string;
  ref_name: string | null;
  head_sha: string | null;
  enqueue_source: "manual" | "push";
  status: "queued" | "running" | "succeeded" | "failed";
  attempts: number;
  findings_count: number | null;
  last_error: string | null;
  queued_at: string;
  started_at: string | null;
  finished_at: string | null;
}

interface QueueClaimRow extends QueueRow {
  connection_id: string;
  github_installation_id: number;
}

function mapConnection(row: ConnectionRow): GitHubConnection {
  return {
    id: row.id,
    organizationId: row.agency_org_id,
    externalAccountId: row.external_account_id,
    installationId: row.github_installation_id,
    targetType: row.github_installation_target_type ?? "organization",
    targetLogin: row.github_installation_target_login,
    repositorySelection: row.github_repository_selection ?? "selected",
    connectedAt: row.created_at,
    lastVerifiedAt: row.last_verified_at,
    lastWebhookAt: row.last_webhook_at,
    installMetadata: row.install_metadata ?? {},
  };
}

function mapQueueRow(row: QueueRow): GitHubScanQueueItem {
  return {
    id: row.id,
    repoFullName: row.repo_full_name,
    refName: row.ref_name,
    headSha: row.head_sha,
    enqueueSource: row.enqueue_source,
    status: row.status,
    attempts: row.attempts,
    findingsCount: row.findings_count,
    lastError: row.last_error,
    queuedAt: row.queued_at,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  };
}

function allowsFile(path: string, size?: number): boolean {
  if (size !== undefined && size > MAX_FILE_BYTES) return false;
  const index = path.lastIndexOf(".");
  if (index === -1) return false;
  const ext = path.slice(index).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) && !path.includes("node_modules/") && !path.includes("dist/");
}

async function githubRequest<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GITHUB_API_URL}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `******
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  return (await res.json()) as T;
}

async function fetchRepoFiles(token: string, repoFullName: string): Promise<RepoFile[]> {
  const tree = await githubRequest<{ tree?: TreeEntry[] }>(`/repos/${repoFullName}/git/trees/HEAD?recursive=1`, token);
  const blobs = (tree.tree ?? [])
    .filter((entry) => entry.type === "blob" && entry.sha && allowsFile(entry.path, entry.size))
    .slice(0, MAX_FILES);

  const files = await Promise.all(
    blobs.map(async (entry) => {
      const blob = await githubRequest<{ content?: string; encoding?: string }>(
        `/repos/${repoFullName}/git/blobs/${entry.sha}`,
        token
      );
      if (!blob.content || blob.encoding !== "base64") return null;
      const content = Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
      return { path: entry.path, content } satisfies RepoFile;
    })
  );

  return files.filter((file): file is RepoFile => file !== null);
}

async function getInstallationToken(connection: GitHubConnection): Promise<string> {
  return createInstallationAccessToken(connection.installationId);
}

async function selectConnection(
  client: ReturnType<typeof createClient> | ReturnType<typeof createAdminClient>,
  filter: { organizationId?: string; id?: string }
): Promise<GitHubConnection | null> {
  let query = client
    .schema("connector")
    .from("connector_connections")
    .select(
      "id, agency_org_id, external_account_id, github_installation_id, github_installation_target_type, github_installation_target_login, github_repository_selection, created_at, last_verified_at, last_webhook_at, install_metadata"
    )
    .eq("platform", "github")
    .eq("integration_type", "github_app")
    .eq("status", "active")
    .not("github_installation_id", "is", null)
    .order("created_at", { ascending: false });

  if (filter.organizationId) query = query.eq("agency_org_id", filter.organizationId);
  if (filter.id) query = query.eq("id", filter.id);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return mapConnection(data as ConnectionRow);
}

export async function getGitHubConnection(organizationId: string): Promise<GitHubConnection | null> {
  const supabase = await createClient();
  return selectConnection(supabase, { organizationId });
}

export async function getGitHubConnectionById(id: string): Promise<GitHubConnection | null> {
  const admin = createAdminClient();
  return selectConnection(admin, { id });
}

export async function getReposForConnection(connection: GitHubConnection): Promise<string[]> {
  return listInstallationRepositories(connection.installationId);
}

export async function scanAndStoreFindings(
  connection: GitHubConnection,
  repoFullName: string
): Promise<{ ok: true; findings: RepoFinding[] } | { ok: false; error: string }> {
  try {
    const token = await getInstallationToken(connection);
    const files = await fetchRepoFiles(token, repoFullName);
    const findings = parseRepo(repoFullName, files);

    const admin = createAdminClient();
    const { error } = await admin
      .schema("connector")
      .from("github_findings")
      .delete()
      .eq("connection_id", connection.id)
      .eq("repo_full_name", repoFullName);
    if (error) return { ok: false, error: "Could not clear previous findings." };

    if (findings.length > 0) {
      const rows = findings.map((finding) => ({
        connection_id: connection.id,
        repo_full_name: repoFullName,
        path: finding.path ?? null,
        finding_type: finding.type,
        severity: finding.severity,
        message: finding.message,
        line_number: finding.lineNumber ?? null,
        metadata: finding.metadata,
      }));
      const { error: insertError } = await admin.schema("connector").from("github_findings").insert(rows);
      if (insertError) return { ok: false, error: "Could not store findings." };
    }

    await admin
      .schema("connector")
      .from("connector_connections")
      .update({ last_verified_at: new Date().toISOString() })
      .eq("id", connection.id);

    return { ok: true, findings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function listRecentGitHubPushEvents(connectionId: string, limit = 10): Promise<GitHubPushEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("connector")
    .from("github_push_events")
    .select("id, repo_full_name, ref_name, after_sha, sender_login, created_at")
    .eq("connection_id", connectionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (
    data as Array<{
      id: string;
      repo_full_name: string;
      ref_name: string | null;
      after_sha: string | null;
      sender_login: string | null;
      created_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    repoFullName: row.repo_full_name,
    refName: row.ref_name,
    afterSha: row.after_sha,
    senderLogin: row.sender_login,
    createdAt: row.created_at,
  }));
}

export async function listRecentGitHubScans(connectionId: string, limit = 10): Promise<GitHubScanQueueItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("connector")
    .from("github_scan_queue")
    .select(
      "id, repo_full_name, ref_name, head_sha, enqueue_source, status, attempts, findings_count, last_error, queued_at, started_at, finished_at"
    )
    .eq("connection_id", connectionId)
    .order("queued_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as QueueRow[]).map(mapQueueRow);
}

export async function enqueueGitHubScan(input: {
  connectionId: string;
  installationId: number;
  repoFullName: string;
  repoId?: number | null;
  refName?: string | null;
  headSha?: string | null;
  pushEventId?: string | null;
  enqueueSource: "manual" | "push";
  createdBy?: string | null;
}): Promise<{ queued: boolean; duplicate: boolean; id: string | null }> {
  const admin = createAdminClient();
  const dedupeKey =
    input.enqueueSource === "push" && input.headSha
      ? `${input.connectionId}:${input.repoFullName}:${input.headSha}`
      : null;
  const { data, error } = await admin
    .schema("connector")
    .from("github_scan_queue")
    .upsert(
      {
        connection_id: input.connectionId,
        github_installation_id: input.installationId,
        repo_id: input.repoId ?? null,
        repo_full_name: input.repoFullName,
        ref_name: input.refName ?? null,
        head_sha: input.headSha ?? null,
        enqueue_source: input.enqueueSource,
        push_event_id: input.pushEventId ?? null,
        created_by: input.createdBy ?? null,
        dedupe_key: dedupeKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    queued: Boolean(data),
    duplicate: !data,
    id: (data as { id: string } | null)?.id ?? null,
  };
}

async function claimGitHubScanBatch(workerId: string, batchSize: number): Promise<QueueClaimRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("connector")
    .from("github_scan_queue")
    .select(
      "id, connection_id, github_installation_id, repo_full_name, ref_name, head_sha, enqueue_source, status, attempts, findings_count, last_error, queued_at, started_at, finished_at"
    )
    .eq("status", "queued")
    .order("queued_at", { ascending: true })
    .limit(Math.max(batchSize * 3, batchSize));
  if (error || !data) return [];

  const claimed: QueueClaimRow[] = [];
  for (const row of data as QueueClaimRow[]) {
    if (claimed.length >= batchSize) break;
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .schema("connector")
      .from("github_scan_queue")
      .update({
        status: "running",
        worker_id: workerId,
        started_at: now,
        updated_at: now,
        attempts: row.attempts + 1,
      })
      .eq("id", row.id)
      .eq("status", "queued")
      .select(
        "id, connection_id, github_installation_id, repo_full_name, ref_name, head_sha, enqueue_source, status, attempts, findings_count, last_error, queued_at, started_at, finished_at"
      )
      .maybeSingle();
    if (!updateError && updated) claimed.push(updated as QueueClaimRow);
  }
  return claimed;
}

async function updateGitHubScanStatus(id: string, patch: Record<string, unknown>): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .schema("connector")
    .from("github_scan_queue")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function processGitHubScanQueue(options: {
  workerId: string;
  batchSize?: number;
}): Promise<{ claimed: number; succeeded: number; failed: number }> {
  const claimedRows = await claimGitHubScanBatch(options.workerId, options.batchSize ?? 5);
  let succeeded = 0;
  let failed = 0;

  for (const row of claimedRows) {
    const connection = await getGitHubConnectionById(row.connection_id);
    if (!connection) {
      await updateGitHubScanStatus(row.id, {
        status: "failed",
        last_error: "GitHub connection not found.",
        finished_at: new Date().toISOString(),
      });
      failed += 1;
      continue;
    }

    const result = await scanAndStoreFindings(connection, row.repo_full_name);
    if (result.ok) {
      await updateGitHubScanStatus(row.id, {
        status: "succeeded",
        findings_count: result.findings.length,
        last_error: null,
        finished_at: new Date().toISOString(),
      });
      succeeded += 1;
    } else {
      await updateGitHubScanStatus(row.id, {
        status: "failed",
        last_error: result.error,
        finished_at: new Date().toISOString(),
      });
      failed += 1;
    }
  }

  return { claimed: claimedRows.length, succeeded, failed };
}
