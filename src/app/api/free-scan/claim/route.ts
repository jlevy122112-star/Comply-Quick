import { NextResponse } from "next/server";
import { claimFreeScan, isValidClaimEmail, normalizeClaimEmail, normalizeClaimSource } from "@/lib/free-scan";
import { createRateLimiter, enforceRateLimit, errorResponse, getClientKey, logger } from "@/services";

const log = logger.child({ module: "api:free-scan:claim" });
const limiter = createRateLimiter({ limit: 5, windowMs: 60_000 });

export async function POST(request: Request) {
  let rateHeaders: Record<string, string>;
  try {
    rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
  } catch (limitErr) {
    return errorResponse(limitErr);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400, headers: rateHeaders });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const email = normalizeClaimEmail(body.email);
  if (!isValidClaimEmail(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400, headers: rateHeaders });
  }
  const source = normalizeClaimSource(body.source, "landing");

  try {
    const result = await claimFreeScan(email, source);
    if (result.status === "already_used") {
      return NextResponse.json(
        {
          ok: false,
          error: "already_used",
          message: "This email has already used its one-time free scan.",
        },
        { status: 409, headers: rateHeaders }
      );
    }

    return NextResponse.json(
      { ok: true, status: result.status, token: result.claim.token, email: result.claim.email },
      { headers: rateHeaders }
    );
  } catch (err) {
    log.error("free scan claim failed", { reason: err instanceof Error ? err.message : "error" });
    return NextResponse.json({ error: "claim_failed" }, { status: 500, headers: rateHeaders });
  }
}
