// Authentication + rate limiting for the metered public API (`/api/v1/*`).
//
// Requests present a bearer API key (`Authorization: Bearer cq_live_…`). We
// resolve it to its owner, require a paid entitlement (Solo / Agency / Enterprise
// integrations), and enforce a per-key fixed-window rate limit. The resolved
// context is handed to the route so it can scope all work to the key's owner.

import { NextRequest } from "next/server";
import { resolveApiKey } from "@/lib/api/keys";
import { getEntitlementForUser } from "@/lib/entitlements";
import { paidPlansLabel } from "@/lib/tier-copy";
import { createRateLimiter, enforceRateLimit } from "@/services";
import { ForbiddenError, UnauthorizedError } from "@/services/errors";
import type { Tier } from "@/lib/pricing";

// 120 requests/min per key — generous for integrations, protective of the box.
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export interface ApiContext {
  userId: string;
  keyId: string;
  tier: Tier;
  /** Rate-limit headers to attach to the response. */
  rateHeaders: Record<string, string>;
}

/** Extracts the bearer token from an Authorization header, if present. */
export function bearerToken(headers: Headers): string | null {
  const auth = headers.get("authorization");
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() ?? null;
}

/**
 * Authenticates a metered-API request. Throws UnauthorizedError for a missing or
 * invalid key, ForbiddenError when the owner's plan lacks API access, and
 * RateLimitError when the key is over budget. Returns the request context on
 * success.
 */
export async function authenticateApiRequest(request: NextRequest): Promise<ApiContext> {
  const token = bearerToken(request.headers);
  if (!token) throw new UnauthorizedError("Provide an API key as 'Authorization: Bearer <key>'.");

  const resolved = await resolveApiKey(token);
  if (!resolved) throw new UnauthorizedError("Invalid or revoked API key.");

  const rateHeaders = enforceRateLimit(await limiter.check(resolved.keyId));

  const entitlement = await getEntitlementForUser(resolved.userId);
  if (!entitlement.isPremium) {
    throw new ForbiddenError(`The API is available on paid plans (${paidPlansLabel()}).`);
  }

  return { userId: resolved.userId, keyId: resolved.keyId, tier: entitlement.tier, rateHeaders };
}
