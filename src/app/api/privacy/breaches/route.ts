import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeBreach, createBreachIncident, listBreachIncidents } from "@/lib/privacy/breach";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

/** Lists the caller's breach incidents. */
export async function GET() {
  try {
    await requireUser();
    const incidents = await listBreachIncidents();
    return NextResponse.json({ incidents });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Files a new breach incident. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
    await requireUser();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const normalized = normalizeBreach(body);
    if (!normalized.ok) throw new ValidationError(normalized.error);

    const result = await createBreachIncident(normalized.value);
    if (!result.ok) throw new ValidationError(result.error);

    return NextResponse.json({ ok: true, id: result.id }, { status: 201, headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
