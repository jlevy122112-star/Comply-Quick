import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateAgency, updateBranding } from "@/lib/agency/service";
import {
  createRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

/** Returns the caller's agency workspace, creating it on first access. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const agency = await getOrCreateAgency();
    return NextResponse.json({ agency });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Updates white-label branding. Body: { name?, logoUrl?, primaryColor?, supportEmail? }. */
export async function PATCH(request: NextRequest) {
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

    const agency = await updateBranding({
      name: typeof body.name === "string" ? body.name : undefined,
      logoUrl: body.logoUrl === null || typeof body.logoUrl === "string" ? (body.logoUrl as string | null) : undefined,
      primaryColor: typeof body.primaryColor === "string" ? body.primaryColor : undefined,
      supportEmail:
        body.supportEmail === null || typeof body.supportEmail === "string"
          ? (body.supportEmail as string | null)
          : undefined,
    });
    return NextResponse.json({ agency }, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
