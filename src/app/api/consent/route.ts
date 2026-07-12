import { NextRequest, NextResponse } from "next/server";
import { normalizeConsent, recordConsent } from "@/lib/consent/records";
import { createRateLimiter, getClientKey, enforceRateLimit, errorResponse, ValidationError } from "@/services";

// Public endpoint: called cross-origin by the generated cookie banner running on
// a merchant's site to record proof of consent. Unauthenticated by design, so
// keep a firm per-client budget to blunt abuse.
const limiter = createRateLimiter({ limit: 60, windowMs: 60_000 });

// The banner runs on arbitrary merchant origins, so this endpoint is CORS-open
// for the write. It records pseudonymous consent only and never returns data.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Records a single consent decision for a project.
 * Body: { projectId, subjectRef, action, categories?, consentModel?, policyVersion?, region? }
 */
export async function POST(request: NextRequest) {
  let rateHeaders: Record<string, string> = {};
  try {
    rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));

    // The banner beacons a `text/plain` body (a CORS "simple" content type) to
    // avoid a preflight round-trip. `Request.json()` parses the body as JSON
    // regardless of Content-Type, so this handles both text/plain and
    // application/json — do not swap in a Content-Type-gated parser here or the
    // banner's beacon would silently stop being recorded.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const normalized = normalizeConsent(body);
    if (!normalized.ok) throw new ValidationError(normalized.error);

    // Fall back to the request header when the client omits userAgent, but bound
    // it to the same 512-char cap normalizeConsent enforces so a hostile client
    // cannot bloat the ledger with an oversized header.
    const headerUa = (request.headers.get("user-agent") ?? "").slice(0, 512) || null;
    const result = await recordConsent({
      ...normalized.value,
      userAgent: normalized.value.userAgent ?? headerUa,
    });
    if (!result.ok) throw new ValidationError(result.error);

    return NextResponse.json(
      { ok: true, id: result.id },
      { status: 201, headers: { ...rateHeaders, ...CORS_HEADERS } }
    );
  } catch (err) {
    const response = errorResponse(err);
    for (const [k, v] of Object.entries({ ...rateHeaders, ...CORS_HEADERS })) {
      response.headers.set(k, v);
    }
    return response;
  }
}
