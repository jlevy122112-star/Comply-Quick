// Vercel custom-domain provisioning (Phase 5, white-label portal).
//
// The app runs on Vercel, so the simplest way to serve a client-owned domain
// with automatic TLS is to attach it to the Vercel project: Vercel issues and
// renews the certificate and reports the DNS record the client must set. No
// extra product enrollment is required (unlike Cloudflare-for-SaaS).
//
// Config (env): VERCEL_API_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID.

import { logger } from "@/services";
import type { DomainProvider, DomainProvisionResult, DomainVerification } from "./domain-provider";

const log = logger.child({ module: "vercel-domains" });
const API_BASE = "https://api.vercel.com";

export class VercelError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "VercelError";
    this.code = code;
  }
}

function config(): { token: string; projectId: string; teamId: string } {
  const token = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId || !teamId) throw new VercelError("Vercel is not configured.");
  return { token, projectId, teamId };
}

export function isVercelConfigured(): boolean {
  return Boolean(process.env.VERCEL_API_TOKEN && process.env.VERCEL_PROJECT_ID && process.env.VERCEL_TEAM_ID);
}

interface VercelErrorBody {
  error?: { code?: string; message?: string };
}

async function vercel<T>(path: string, init?: RequestInit): Promise<T> {
  const { token, teamId } = config();
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${API_BASE}${path}${sep}teamId=${teamId}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & VercelErrorBody;
  if (!res.ok) {
    throw new VercelError(body.error?.message ?? `Vercel request failed (${res.status}).`, body.error?.code);
  }
  return body as T;
}

interface VercelDomainResponse {
  name: string;
  verified: boolean;
  verification?: { type: string; domain: string; value: string; reason?: string }[];
}

interface VercelDomainConfig {
  misconfigured: boolean;
  /** Recommended CNAME target when the domain is a subdomain. */
  recommendedCNAME?: { rank: number; value: string }[];
}

function mapVerifications(res: VercelDomainResponse): DomainVerification[] {
  return (res.verification ?? []).map((v) => ({ type: v.type, name: v.domain, value: v.value }));
}

async function toResult(res: VercelDomainResponse): Promise<DomainProvisionResult> {
  let cname: string | undefined;
  try {
    const cfg = await vercel<VercelDomainConfig>(`/v6/domains/${res.name}/config`);
    cname = cfg.recommendedCNAME?.[0]?.value;
  } catch {
    // Config lookup is best-effort; the app shows a sensible default otherwise.
  }
  return { verified: res.verified, verifications: mapVerifications(res), cname };
}

export const vercelProvider: DomainProvider = {
  id: "vercel",

  async provision(domain: string): Promise<DomainProvisionResult> {
    const { projectId } = config();
    try {
      const res = await vercel<VercelDomainResponse>(`/v10/projects/${projectId}/domains`, {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      });
      log.info("Added domain to Vercel project", { domain, verified: res.verified });
      return await toResult(res);
    } catch (err) {
      // Already attached to this project → treat as an idempotent success.
      if (err instanceof VercelError && err.code === "domain_already_in_use") {
        return this.check(domain);
      }
      throw err;
    }
  },

  async check(domain: string): Promise<DomainProvisionResult> {
    const { projectId } = config();
    const res = await vercel<VercelDomainResponse>(`/v9/projects/${projectId}/domains/${domain}`);
    return toResult(res);
  },

  async remove(domain: string): Promise<void> {
    const { projectId } = config();
    try {
      await vercel(`/v9/projects/${projectId}/domains/${domain}`, { method: "DELETE" });
    } catch (err) {
      log.warn("Failed to remove Vercel domain", { domain, error: err instanceof Error ? err.message : String(err) });
    }
  },
};
