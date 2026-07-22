// GitHub integration service.
//
// Provides the end-to-end flow for an authenticated GitHub connection:
// retrieve the encrypted access token, list repositories, fetch file contents,
// run the compliance parser, and persist findings.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/connector/crypto";
import { listRepositories } from "./oauth";
import { parseRepo, type RepoFinding, type RepoFile } from "./parser";

const MAX_FILE_BYTES = 100 * 1024;
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
  externalAccountId: string;
  accessTokenEnc: string;
}

interface ConnectionRow {
  id: string;
  external_account_id: string;
  access_token_enc: string;
}

export async function getGitHubConnection(organizationId: string): Promise<GitHubConnection | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("connector")
    .from("connector_connections")
    .select("id, external_account_id, access_token_enc")
    .eq("agency_org_id", organizationId)
    .eq("platform", "github")
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: (data as ConnectionRow).id,
    externalAccountId: (data as ConnectionRow).external_account_id,
    accessTokenEnc: (data as ConnectionRow).access_token_enc,
  };
}

export async function getReposForConnection(connection: GitHubConnection): Promise<string[]> {
  const token = decryptToken(connection.accessTokenEnc);
  return listRepositories(token);
}

interface TreeEntry {
  path: string;
  type: string;
  size?: number;
}

function allowsFile(path: string, size?: number): boolean {
  if (size !== undefined && size > MAX_FILE_BYTES) return false;
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) && !path.includes("node_modules/") && !path.includes("dist/");
}

async function fetchFileContent(token: string, repoFullName: string, path: string): Promise<RepoFile | null> {
  try {
    const res = await fetch(`https://raw.githubusercontent.com/${repoFullName}/HEAD/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const content = await res.text();
    return { path, content };
  } catch {
    return null;
  }
}

async function fetchRepoFiles(token: string, repoFullName: string): Promise<RepoFile[]> {
  const [owner, repo] = repoFullName.split("/");
  if (!owner || !repo) return [];
  const treeRes = await fetch(`https://api.github.com/repos/${repoFullName}/git/trees/HEAD?recursive=1`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!treeRes.ok) throw new Error(`Could not fetch tree for ${repoFullName}`);
  const tree = (await treeRes.json()) as { tree: TreeEntry[] };
  const paths = tree.tree.filter((e) => e.type === "blob" && allowsFile(e.path, e.size)).slice(0, 50);
  const files = await Promise.all(paths.map((p) => fetchFileContent(token, repoFullName, p.path)));
  return files.filter((f): f is RepoFile => f !== null);
}

/**
 * Scans a repository and stores findings, scoped to the active org's connection.
 */
export async function scanAndStoreFindings(
  connection: GitHubConnection,
  repoFullName: string
): Promise<{ ok: true; findings: RepoFinding[] } | { ok: false; error: string }> {
  try {
    const token = decryptToken(connection.accessTokenEnc);
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
      const rows = findings.map((f) => ({
        connection_id: connection.id,
        repo_full_name: repoFullName,
        path: f.path ?? null,
        finding_type: f.type,
        severity: f.severity,
        message: f.message,
        line_number: f.lineNumber ?? null,
        metadata: f.metadata,
      }));
      const { error: insertError } = await admin.schema("connector").from("github_findings").insert(rows);
      if (insertError) return { ok: false, error: "Could not store findings." };
    }

    return { ok: true, findings };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getFindingsForRepo(connectionId: string, repoFullName: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .schema("connector")
    .from("github_findings")
    .select("*")
    .eq("connection_id", connectionId)
    .eq("repo_full_name", repoFullName)
    .order("created_at", { ascending: false });
  return data ?? [];
}
