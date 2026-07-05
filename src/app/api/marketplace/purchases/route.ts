import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listMyPurchases } from "@/lib/marketplace/service";
import { startTemplateCheckout } from "@/lib/marketplace/stripe-connect";
import {
  InMemoryRateLimiter,
  getClientKey,
  enforceRateLimit,
  errorResponse,
  UnauthorizedError,
  ValidationError,
} from "@/services";

const limiter = new InMemoryRateLimiter({ limit: 20, windowMs: 60_000 });

/** Lists the caller's purchases. */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();
    const purchases = await listMyPurchases();
    return NextResponse.json({ purchases });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Starts a purchase. Body: { templateId }. Returns { url } for a paid template
 * (Stripe Checkout) or { claimed: true } when the template is free.
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
    if (typeof body.templateId !== "string" || body.templateId.length === 0) {
      throw new ValidationError("templateId is required.");
    }

    const origin = request.headers.get("origin") ?? "http://localhost:3000";
    const result = await startTemplateCheckout(body.templateId, origin);
    return NextResponse.json(result, { headers: rateHeaders });
  } catch (err) {
    return errorResponse(err);
  }
}
