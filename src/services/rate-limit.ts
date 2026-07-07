// Rate limiting for the Compliance OS.
//
// Two backends implement the same async `RateLimiter` interface:
//
//   • InMemoryRateLimiter — a fixed-window limiter scoped to a single runtime
//     instance. Correct only when one process sees all traffic. On Vercel's
//     serverless/multi-instance runtime the map is NOT shared across instances,
//     so the *effective* limit is `limit × instanceCount`.
//
//   • UpstashRateLimiter — a distributed fixed-window limiter backed by Upstash
//     Redis over its REST API (no extra npm dependency; uses fetch). Because the
//     counter lives in Redis, the limit is enforced globally across every
//     instance.
//
// `createRateLimiter()` picks the distributed backend automatically when the
// Upstash env vars are present and falls back to in-memory otherwise, so call
// sites never change: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in
// production and the same limits become cluster-wide.

import { logger } from "./logger";

const log = logger.child({ module: "rate-limit" });

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Epoch ms at which the current window resets. */
  resetAt: number;
  /** Seconds until reset — convenient for a Retry-After header. */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  /**
   * Records one hit for `key` and reports whether it is within the limit.
   * Async so a distributed backend (Redis) can be swapped in transparently.
   */
  check(key: string): Promise<RateLimitResult>;
}

export interface RateLimitConfig {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}

interface Window {
  count: number;
  resetAt: number;
}

function buildResult(count: number, limit: number, resetAt: number, now: number): RateLimitResult {
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: Math.max(0, Math.ceil((resetAt - now) / 1000)),
  };
}

export class InMemoryRateLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(config: RateLimitConfig) {
    this.limit = config.limit;
    this.windowMs = config.windowMs;
    this.now = config.now ?? Date.now;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = this.now();
    this.sweep(now);

    let window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }

    window.count += 1;
    return buildResult(window.count, this.limit, window.resetAt, now);
  }

  /** Drops expired windows so the map does not grow unbounded. */
  private sweep(now: number): void {
    if (now - this.lastSweep < this.windowMs) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) this.windows.delete(key);
    }
  }
}

/**
 * Distributed fixed-window limiter backed by Upstash Redis (REST). The counter
 * key is bucketed by window so it expires on its own; INCR + PEXPIRE run in a
 * single pipeline round-trip. On any transport error it fails **open** (allows
 * the request) so a Redis outage degrades protection rather than availability —
 * the error is logged so it is visible in monitoring.
 */
export class UpstashRateLimiter implements RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly restUrl: string;
  private readonly restToken: string;

  constructor(config: RateLimitConfig & { restUrl: string; restToken: string }) {
    this.limit = config.limit;
    this.windowMs = config.windowMs;
    this.now = config.now ?? Date.now;
    this.restUrl = config.restUrl.replace(/\/$/, "");
    this.restToken = config.restToken;
  }

  async check(key: string): Promise<RateLimitResult> {
    const now = this.now();
    const bucket = Math.floor(now / this.windowMs);
    const resetAt = (bucket + 1) * this.windowMs;
    const redisKey = `rl:${key}:${bucket}`;

    try {
      const res = await fetch(`${this.restUrl}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.restToken}`,
          "Content-Type": "application/json",
        },
        // INCR the window counter, then (re)set its TTL to just past the window.
        body: JSON.stringify([
          ["INCR", redisKey],
          ["PEXPIRE", redisKey, String(this.windowMs + 1000)],
        ]),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Upstash responded ${res.status}`);
      }

      const payload = (await res.json()) as Array<{ result?: number; error?: string }>;
      const incr = payload[0];
      if (!incr || typeof incr.result !== "number") {
        throw new Error(incr?.error ?? "Unexpected Upstash pipeline response");
      }

      return buildResult(incr.result, this.limit, resetAt, now);
    } catch (err) {
      log.error("Distributed rate-limit check failed; failing open", {
        message: err instanceof Error ? err.message : String(err),
      });
      // Fail open: report an allowed request with a full window remaining.
      return buildResult(1, this.limit, resetAt, now);
    }
  }
}

/**
 * Builds the appropriate limiter for the current environment. Uses Upstash Redis
 * when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set (limits shared
 * across all instances); otherwise falls back to the per-instance in-memory
 * limiter. Call sites stay identical across environments.
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) {
    return new UpstashRateLimiter({ ...config, restUrl, restToken });
  }
  return new InMemoryRateLimiter(config);
}

/**
 * Derives a client identity for rate limiting from request headers.
 *
 * ⚠️ TRUSTED-PROXY ASSUMPTION: this reads the **left-most** `x-forwarded-for`
 * hop as the client IP. That is correct behind Vercel (and any proxy that
 * *prepends* the real client and strips inbound XFF), but `x-forwarded-for` is
 * client-settable. If this app is ever deployed somewhere clients can reach the
 * origin directly — or behind a proxy that appends rather than replaces XFF — an
 * attacker can rotate the header to mint unlimited rate-limit buckets and bypass
 * limits entirely. In that case, switch to the right-most trusted hop (peel off
 * exactly the number of proxies in front of the app) or a platform-verified
 * client-IP header, and do NOT trust raw `x-forwarded-for`.
 */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "anonymous";
}
