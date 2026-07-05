import { NextRequest, NextResponse } from "next/server";
import { getPartnerConnectOnboardingLink } from "@/lib/partners/stripe-connect";
import { errorResponse } from "@/services";

/** Returns a Stripe Connect onboarding link so the partner can receive payouts. */
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    const { url } = await getPartnerConnectOnboardingLink(origin);
    return NextResponse.json({ url });
  } catch (err) {
    return errorResponse(err);
  }
}
