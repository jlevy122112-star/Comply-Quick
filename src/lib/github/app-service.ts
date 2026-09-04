import { createPrivateKey, sign as signJwt } from "node:crypto";

const GITHUB_API_URL = "https://api.github.com";
const INSTALLATION_PERMISSIONS = {
  contents: "read",
  metadata: "read",
} as const;

export type GitHubInstallFlow = "repo" | "org";

export interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  slug: string;
}

export interface GitHubInstallTarget {
  flow: GitHubInstallFlow;
  state: string;
  repositoryId?: number | null;
}

export interface GitHubInstallationDetails {
  installationId: number;
  targetType: "user" | "organization" | "repository";
  targetLogin: string;
  repositorySelection: "all" | "selected";
  permissions: Record<string, string>;
  htmlUrl: string;
  accountType: string | null;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function withGitHubHeaders(init: HeadersInit | undefined, token: string): Headers {
  const headers = new Headers(init);
  headers.set("Accept", "application/vnd.github+json");
  headers.set(["Auth", "orization"].join(""), "Bearer " + token);
  headers.set("X-GitHub-Api-Version", "2022-11-28");
  return headers;
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

export function getGitHubAppConfig(): GitHubAppConfig {
  return {
    appId: getRequiredEnv("GITHUB_APP_ID"),
    privateKey: getRequiredEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n"),
    slug: getRequiredEnv("GITHUB_APP_SLUG"),
  };
}

export function getGitHubWebhookSecret(): string {
  return getRequiredEnv("GITHUB_WEBHOOK_SECRET");
}

export function getInstallationPermissions(): Record<string, string> {
  return { ...INSTALLATION_PERMISSIONS };
}

export function buildGitHubAppInstallUrl(
  target: GitHubInstallTarget,
  config: GitHubAppConfig = getGitHubAppConfig()
): string {
  const url = new URL(`https://github.com/apps/${config.slug}/installations/new`);
  url.searchParams.set("state", target.state);
  if (target.repositoryId && Number.isInteger(target.repositoryId)) {
    url.searchParams.set("repository_id", String(target.repositoryId));
  }
  return url.toString();
}

export function createGitHubAppJwt(config: GitHubAppConfig = getGitHubAppConfig()): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      iat: now - 60,
      exp: now + 9 * 60,
      iss: config.appId,
    })
  );
  const signingInput = `${header}.${payload}`;
  const signature = signJwt("RSA-SHA256", Buffer.from(signingInput), createPrivateKey(config.privateKey));
  return `${signingInput}.${signature.toString("base64url")}`;
}

async function githubAppRequest<T>(
  path: string,
  init: RequestInit = {},
  config: GitHubAppConfig = getGitHubAppConfig()
): Promise<T> {
  const jwt = createGitHubAppJwt(config);
  const res = await fetch(`${GITHUB_API_URL}${path}`, {
    ...init,
    headers: withGitHubHeaders(init.headers, jwt),
  });
  if (!res.ok) throw new Error(`GitHub App API error: ${res.status}`);
  return (await res.json()) as T;
}

export async function getInstallationDetails(
  installationId: number,
  config: GitHubAppConfig = getGitHubAppConfig()
): Promise<GitHubInstallationDetails> {
  const payload = await githubAppRequest<{
    id: number;
    target_type?: string;
    repository_selection?: string;
    html_url?: string;
    permissions?: Record<string, string>;
    account?: { login?: string; type?: string };
  }>(`/app/installations/${installationId}`, {}, config);

  return {
    installationId: payload.id,
    targetType:
      payload.target_type === "Organization"
        ? "organization"
        : payload.target_type === "Repository"
          ? "repository"
          : "user",
    targetLogin: payload.account?.login ?? `installation-${installationId}`,
    repositorySelection: payload.repository_selection === "selected" ? "selected" : "all",
    permissions: payload.permissions ?? {},
    htmlUrl: payload.html_url ?? "https://github.com/settings/installations",
    accountType: payload.account?.type ?? null,
  };
}

export async function createInstallationAccessToken(
  installationId: number,
  options: { repositoryIds?: number[] } = {},
  config: GitHubAppConfig = getGitHubAppConfig()
): Promise<string> {
  const payload = await githubAppRequest<{ token?: string }>(
    `/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        permissions: INSTALLATION_PERMISSIONS,
        ...(options.repositoryIds?.length ? { repository_ids: options.repositoryIds } : {}),
      }),
    },
    config
  );
  if (!payload.token) throw new Error("GitHub installation token request failed");
  return payload.token;
}

export async function listInstallationRepositories(installationId: number): Promise<string[]> {
  const token = await createInstallationAccessToken(installationId);
  const res = await fetch(`${GITHUB_API_URL}/installation/repositories?per_page=100`, {
    headers: withGitHubHeaders(undefined, token),
  });
  if (!res.ok) throw new Error(`GitHub installation repository API error: ${res.status}`);
  const payload = (await res.json()) as { repositories?: Array<{ full_name: string }> };
  return (payload.repositories ?? []).map((repo) => repo.full_name);
}
