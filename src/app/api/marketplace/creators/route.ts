import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateCreatorProfile } from "@/lib/marketplace/service";
import { getConnectOnboardingLink, getPayoutStatus, isConnectConfigured } from "@/lib/marketplace/stripe-connect";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 15, windowMs: 60_000 });

/** Returns the caller's creator profile + payout status (null creator if none). */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const status = await getPayoutStatus();
    return NextResponse.json({ ...status, connectConfigured: isConnectConfigured() });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Creator actions. Body: { action: "onboard" } → returns a Stripe Connect
 * onboarding URL; { action: "update", displayName?, bio? } → updates profile.
 */
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

    if (body.action === "onboard") {
      const origin = request.headers.get("origin") ?? "http://localhost:3000";
      const link = await getConnectOnboardingLink(origin);
      return NextResponse.json(link, { headers: rateHeaders });
    }

    if (body.action === "update") {
      const creator = await updateCreatorProfile({
        displayName: typeof body.displayName === "string" ? body.displayName : undefined,
        bio: typeof body.bio === "string" ? body.bio : undefined,
      });
      return NextResponse.json({ creator }, { headers: rateHeaders });
    }

    throw new ValidationError("action must be 'onboard' or 'update'.");
  } catch (err) {
    return errorResponse(err);
  }
}
