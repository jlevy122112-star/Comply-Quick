import { describe, it, expect } from "vitest";
import {
  Logger,
  type LogRecord,
  serializeError,
  toAppError,
  AppError,
  ValidationError,
  UnauthorizedError,
  RateLimitError,
  InternalError,
  ok,
  err,
  isOk,
  InMemoryRateLimiter,
  getClientKey,
} from "@/services";

// ─── Logger ──────────────────────────────────────────────────────────────────

describe("Logger", () => {
  function capture(minLevel: "debug" | "info" | "warn" | "error" = "debug") {
    const records: LogRecord[] = [];
    const logger = new Logger({ minLevel, json: true, sink: (r) => records.push(r) });
    return { logger, records };
  }

  it("emits records at or above the configured level", () => {
    const { logger, records } = capture("warn");
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(records.map((r) => r.level)).toEqual(["warn", "error"]);
  });

  it("merges child bindings into every record", () => {
    const { logger, records } = capture();
    logger.child({ module: "scanner", requestId: "abc" }).info("hi", { extra: 1 });
    expect(records[0].context).toEqual({ module: "scanner", requestId: "abc", extra: 1 });
  });

  it("includes an ISO timestamp and message", () => {
    const { logger, records } = capture();
    logger.info("hello");
    expect(records[0].message).toBe("hello");
    expect(records[0].time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ─── Errors ──────────────────────────────────────────────────────────────────

describe("error handling", () => {
  it("exposes 4xx messages but hides 5xx messages", () => {
    const client = serializeError(new ValidationError("bad field", { field: "email" }));
    expect(client.status).toBe(422);
    expect(client.body.message).toBe("bad field");
    expect(client.body.details).toEqual({ field: "email" });

    const server = serializeError(new InternalError("db exploded"));
    expect(server.status).toBe(500);
    expect(server.body.message).toBe("An unexpected error occurred.");
    expect(server.body.code).toBe("internal_error");
  });

  it("wraps unknown throwables as InternalError", () => {
    const wrapped = toAppError("boom");
    expect(wrapped).toBeInstanceOf(InternalError);
    expect(wrapped.statusCode).toBe(500);
    const already = new UnauthorizedError();
    expect(toAppError(already)).toBe(already);
  });

  it("preserves AppError subclass identity and status", () => {
    const e = new RateLimitError(42);
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(429);
    expect(e.retryAfterSeconds).toBe(42);
    expect(serializeError(e).body.details).toEqual({ retryAfterSeconds: 42 });
  });

  it("Result helpers narrow correctly", () => {
    const good = ok(5);
    const bad = err(new ValidationError("no"));
    expect(isOk(good)).toBe(true);
    expect(isOk(bad)).toBe(false);
    if (isOk(good)) expect(good.value).toBe(5);
  });
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

describe("InMemoryRateLimiter", () => {
  it("allows up to the limit then blocks within a window", async () => {
    const t = 1_000;
    const limiter = new InMemoryRateLimiter({ limit: 3, windowMs: 1_000, now: () => t });

    const results = [
      await limiter.check("k"),
      await limiter.check("k"),
      await limiter.check("k"),
      await limiter.check("k"),
    ];
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[2].remaining).toBe(0);
    expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets after the window elapses", async () => {
    let t = 0;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1_000, now: () => t });
    expect((await limiter.check("k")).allowed).toBe(true);
    expect((await limiter.check("k")).allowed).toBe(false);
    t += 1_001;
    expect((await limiter.check("k")).allowed).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const t = 0;
    const limiter = new InMemoryRateLimiter({ limit: 1, windowMs: 1_000, now: () => t });
    expect((await limiter.check("a")).allowed).toBe(true);
    expect((await limiter.check("b")).allowed).toBe(true);
    expect((await limiter.check("a")).allowed).toBe(false);
  });
});

describe("getClientKey", () => {
  it("uses the left-most x-forwarded-for hop", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.9, 70.41.3.18" });
    expect(getClientKey(headers)).toBe("203.0.113.9");
  });

  it("falls back to x-real-ip then a shared bucket", () => {
    expect(getClientKey(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(getClientKey(new Headers())).toBe("anonymous");
  });
});
