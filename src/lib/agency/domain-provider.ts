// Provider-agnostic custom-domain provisioning (Phase 5, white-label portal).
//
// The agency service talks to this interface, not a specific vendor, so the
// backend (Vercel today, Cloudflare-for-SaaS or others later) can change without
// touching call sites. Selection is by env: Vercel if configured, else
// Cloudflare, else none (domains stay `pending` and the portal works via slug).

import { vercelProvider, isVercelConfigured } from "./vercel";
import { cloudflareProvider, isCloudflareConfigured } from "./cloudflare";

/** A DNS record the domain owner must create to verify/route their domain. */
export interface DomainVerification {
  type: string;
  name: string;
  value: string;
}

export interface DomainProvisionResult {
  /** True once the provider considers the domain live (DNS + certificate). */
  verified: boolean;
  /** DNS records the client must add (provider-specific TXT/CNAME challenges). */
  verifications: DomainVerification[];
  /** Recommended CNAME target for the domain, when the provider reports one. */
  cname?: string;
}

export interface DomainProvider {
  readonly id: string;
  /** Registers the domain with the provider; returns current status + DNS steps. */
  provision(domain: string): Promise<DomainProvisionResult>;
  /** Re-checks current status (used by the verify endpoint). */
  check(domain: string): Promise<DomainProvisionResult>;
  /** Best-effort deprovision; never throws. */
  remove(domain: string): Promise<void>;
}

/** The active provider, or null when none is configured. */
export function getDomainProvider(): DomainProvider | null {
  if (isVercelConfigured()) return vercelProvider;
  if (isCloudflareConfigured()) return cloudflareProvider;
  return null;
}
