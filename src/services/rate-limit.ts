// Rate limiting for the Compliance OS.
//
// Ships with an in-memory fixed-window limiter that is correct for a single
// runtime instance and good enough for early production on Vercel. The
// `RateLimiter` interface lets us swap in a distributed backend (Upstash Redis,
// Cloudflare Durable Objects) once traffic is sharded across instances without
// changing call sites.

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
  check(key: string): RateLimitResult;
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

  check(key: string): RateLimitResult {
    const now = this.now();
    this.sweep(now);

    let window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, window);
    }

    window.count += 1;
    const allowed = window.count <= this.limit;
    const remaining = Math.max(0, this.limit - window.count);

    return {
      allowed,
      limit: this.limit,
      remaining,
      resetAt: window.resetAt,
      retryAfterSeconds: Math.max(0, Math.ceil((window.resetAt - now) / 1000)),
    };
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
 * Derives a client identity for rate limiting from request headers. Prefers the
 * left-most x-forwarded-for hop (the real client on Vercel), falling back to
 * x-real-ip and finally a shared bucket so a missing header cannot bypass limits.
 */
export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "anonymous";
}
