import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMembers, addMember } from "@/lib/agency/service";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** Lists the caller agency's team seats. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const members = await listMembers();
    return NextResponse.json({ members });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Adds a team seat by email. Body: { email }. Enforces the tier seat limit. */
export async function POST(request: NextRequest) {
  try {
    const rateHeaders = enforceRateLimit(await limiter.check(getClientKey(request.headers)));
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
    if (typeof body.email !== "string") throw new ValidationError("An email is required.");

    const member = await addMember(body.email);
    return NextResponse.json({ member }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
