import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createScan, QuotaExceededError } from "@/lib/scanner/service";
import { validateScanUrl } from "@/lib/security";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
} from "@/services";

// Scans fetch external URLs — cap volume per client to protect the instance and
// the sites being scanned.
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

/** Runs a compliance scan for the authenticated user (free-tier quota enforced). */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    const url = (body as { url?: unknown } | null)?.url;
    if (typeof url !== "string" || url.trim().length === 0) {
      throw new ValidationError("A website URL is required.");
    }
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    if (!validateScanUrl(withScheme)) {
      throw new ValidationError("That URL cannot be scanned (must be a public http(s) address).");
    }

    try {
      const scan = await createScan(url);
      return NextResponse.json({ scan }, { headers: rateHeaders });
    } catch (err) {
      if (err instanceof QuotaExceededError) throw new ForbiddenError(err.message);
      throw err;
    }
  } catch (err) {
    return errorResponse(err);
  }
}
