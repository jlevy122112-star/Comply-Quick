// Cloudflare-for-SaaS custom-hostname provisioning (Phase 5).
//
// Powers white-label custom domains: a client points a CNAME at the app and we
// register their hostname with Cloudflare, which issues + serves the TLS cert.
// Requires the zone to be enrolled in "SSL for SaaS" (custom hostname quota).
//
// Config (env): CLOUDFLARE_API_TOKEN (Zone → SSL and Certificates: Edit,
// Zone → Zone: Read) and CLOUDFLARE_ZONE_ID. When either is unset the module
// is a no-op so domains simply stay `pending` (portal still works via slug).

import { logger } from "@/services";
import type { DomainProvider, DomainProvisionResult } from "./domain-provider";

const log = logger.child({ module: "cloudflare" });

const API_BASE = "https://api.cloudflare.com/client/v4";

export interface CustomHostnameResult {
  id: string;
  /** Overall hostname status: pending | active | ... (Cloudflare-defined). */
  status: string;
  /** Certificate status: pending_validation | active | ... */
  sslStatus: string;
}

export class CloudflareError extends Error {
  readonly code?: number;
  constructor(message: string, code?: number) {
    super(message);
    this.name = "CloudflareError";
    this.code = code;
  }
}

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID);
}

function config(): { token: string; zoneId: string } {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneId = process.env.CLOUDFLARE_ZONE_ID;
  if (!token || !zoneId) throw new CloudflareError("Cloudflare is not configured.");
  return { token, zoneId };
}

interface CfEnvelope<T> {
  success: boolean;
  errors: { code: number; message: string }[];
  result: T | null;
}

async function cf<T>(path: string, init?: RequestInit): Promise<T> {
  const { token } = config();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json()) as CfEnvelope<T>;
  if (!body.success) {
    const first = body.errors?.[0];
    throw new CloudflareError(first?.message ?? `Cloudflare request failed (${res.status}).`, first?.code);
  }
  if (body.result === null) throw new CloudflareError("Cloudflare returned no result.");
  return body.result;
}

interface CfHostname {
  id: string;
  status: string;
  ssl?: { status?: string };
}

function mapHostname(h: CfHostname): CustomHostnameResult {
  return { id: h.id, status: h.status, sslStatus: h.ssl?.status ?? "unknown" };
}

/** Registers a custom hostname (HTTP validation). Idempotent-ish: Cloudflare
 *  returns the existing record if the hostname was already added. */
export async function createCustomHostname(hostname: string): Promise<CustomHostnameResult> {
  const { zoneId } = config();
  const result = await cf<CfHostname>(`/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({ hostname, ssl: { method: "http", type: "dv" } }),
  });
  log.info("Created Cloudflare custom hostname", { hostname, id: result.id });
  return mapHostname(result);
}

export async function getCustomHostname(id: string): Promise<CustomHostnameResult> {
  const { zoneId } = config();
  return mapHostname(await cf<CfHostname>(`/zones/${zoneId}/custom_hostnames/${id}`));
}

export async function deleteCustomHostname(id: string): Promise<void> {
  const { zoneId } = config();
  try {
    await cf(`/zones/${zoneId}/custom_hostnames/${id}`, { method: "DELETE" });
  } catch (err) {
    // Best-effort cleanup — a missing hostname is fine.
    log.warn("Failed to delete Cloudflare custom hostname", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** A hostname is fully live once both the hostname and its certificate are active. */
export function isHostnameActive(result: CustomHostnameResult): boolean {
  return result.status === "active" && result.sslStatus === "active";
}

function toResult(h: CustomHostnameResult, domain: string): DomainProvisionResult {
  return {
    verified: isHostnameActive(h),
    verifications: [{ type: "CNAME", name: domain, value: process.env.NEXT_PUBLIC_APP_HOST ?? "" }],
  };
}

/**
 * DomainProvider backed by Cloudflare-for-SaaS custom hostnames. Requires the
 * zone to be enrolled in SSL for SaaS (custom-hostname quota). Cloudflare tracks
 * hostnames by name, so `check`/`remove` look up the id from the name first.
 */
export const cloudflareProvider: DomainProvider = {
  id: "cloudflare",

  async provision(domain: string): Promise<DomainProvisionResult> {
    return toResult(await createCustomHostname(domain), domain);
  },

  async check(domain: string): Promise<DomainProvisionResult> {
    const { zoneId } = config();
    const list = await cf<CfHostname[]>(`/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(domain)}`);
    const match = list[0];
    if (!match) return { verified: false, verifications: [] };
    return toResult(mapHostname(match), domain);
  },

  async remove(domain: string): Promise<void> {
    try {
      const { zoneId } = config();
      const list = await cf<CfHostname[]>(`/zones/${zoneId}/custom_hostnames?hostname=${encodeURIComponent(domain)}`);
      if (list[0]) await deleteCustomHostname(list[0].id);
    } catch (err) {
      log.warn("Cloudflare remove failed", { domain, error: err instanceof Error ? err.message : String(err) });
    }
  },
};
