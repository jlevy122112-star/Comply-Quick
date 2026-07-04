import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createScan, QuotaExceededError } from "@/lib/scanner/service";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
  ForbiddenError,
} from "@/services";

// Scans fetch external URLs — cap volume per client to protect the instance and
// the sites being scanned.
const limiter = new InMemoryRateLimiter({ limit: 10, windowMs: 60_000 });

/** Runs a compliance scan for the authenticated user (free-tier quota enforced). */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(limiter.check(getClientKey(request.headers)));

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
