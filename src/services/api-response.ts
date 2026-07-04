// Next.js route-handler glue for the shared error + rate-limit services.
//
// Kept separate from errors.ts / rate-limit.ts (which are framework-agnostic and
// unit-testable without next/server) so those can be reused in Edge Functions,
// scripts, and tests.

import { NextResponse } from "next/server";
import { serializeError, RateLimitError } from "./errors";
import type { RateLimitResult } from "./rate-limit";
import { logger } from "./logger";

/** Converts any thrown value into a JSON NextResponse, logging 5xx causes. */
export function errorResponse(err: unknown): NextResponse {
  const { status, body } = serializeError(err);
  if (status >= 500) {
    logger.error(body.error, { code: body.code, cause: err instanceof Error ? err.message : String(err) });
  }
  const res = NextResponse.json(body, { status });
  if (err instanceof RateLimitError) {
    res.headers.set("Retry-After", String(err.retryAfterSeconds));
  }
  return res;
}

/** Standard rate-limit headers for a response. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

/**
 * Enforces a rate-limit result, throwing RateLimitError when the request is over
 * budget. Returns the headers to attach on success.
 */
export function enforceRateLimit(result: RateLimitResult): Record<string, string> {
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
  return rateLimitHeaders(result);
}
