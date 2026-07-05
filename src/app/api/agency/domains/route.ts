import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listDomains, addDomain } from "@/lib/agency/service";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60_000 });

/** Lists the caller's custom domains. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const domains = await listDomains();
    return NextResponse.json({ domains });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Registers a custom domain (starts as pending). Body: { domain }. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(limiter.check(getClientKey(request.headers)));
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }
    if (typeof body.domain !== "string" || body.domain.trim().length === 0) {
      throw new ValidationError("A domain is required.");
    }

    const domain = await addDomain(body.domain);
    return NextResponse.json({ domain }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
