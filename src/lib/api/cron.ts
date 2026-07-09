// Shared authentication for scheduled (cron) API routes.
//
// All cron entrypoints are gated by a single shared CRON_SECRET presented as a
// Bearer token. Comparison is constant-time (timingSafeEqual) so the secret
// can't be recovered via a timing side-channel.

import { timingSafeEqual } from "node:crypto";
import { UnauthorizedError } from "@/services";

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  // timingSafeEqual throws on length mismatch; compare against a same-length
  // buffer so the early-out itself doesn't leak length via timing.
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Throws UnauthorizedError unless the request carries the correct
 * `Authorization: Bearer <CRON_SECRET>` header. No-op-safe: a missing/empty
 * server secret always rejects.
 */
export function assertCronAuthorized(request: Request): void {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !constantTimeEqual(provided, secret)) {
    throw new UnauthorizedError("Invalid cron secret.");
  }
}
