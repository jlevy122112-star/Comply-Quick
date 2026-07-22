// GitHub OAuth helpers for the Comply-Quick source-code compliance integration.
//
// Implements the GitHub OAuth 2.0 web application flow. The access token is
// returned to the callback route and then encrypted at rest in connector_connections.

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const SCOPES = ["repo", "read:org"];

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildAuthorizeUrl(cfg: GitHubOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: SCOPES.join(" "),
    state,
  });
  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

export interface GitHubToken {
  accessToken: string;
  scope: string;
}

export async function exchangeCodeForToken(code: string, cfg: GitHubOAuthConfig, fetchImpl: typeof fetch = fetch): Promise<GitHubToken> {
  const res = await fetchImpl(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: cfg.redirectUri,
    }).toString(),
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const accessToken = typeof body.access_token === "string" ? body.access_token : "";
  if (!accessToken) {
    throw new Error(typeof body.error_description === "string" ? body.error_description : "GitHub token exchange failed");
  }
  return { accessToken, scope: typeof body.scope === "string" ? body.scope : "" };
}

export async function listRepositories(accessToken: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl("https://api.github.com/user/repos?per_page=100&sort=updated", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const data = (await res.json()) as Array<{ full_name: string }>;
  return data.map((r) => r.full_name);
}
