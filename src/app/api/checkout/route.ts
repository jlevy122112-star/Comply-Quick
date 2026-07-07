import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";
import { getStripe, analytics, logger } from "@/services";
import { TIER_CONFIG, PAID_TIERS, isPaidTier, normalizeTierKey, type Billing, type PaidTier } from "@/lib/pricing";
import { attachReferral } from "@/lib/partners/service";

interface CheckoutRequestBody {
  plan: PaidTier;
  billing?: Billing;
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();

  if (!stripe) {
    return NextResponse.json(
      {
        error: "Stripe is not configured",
        message: "Set the STRIPE_SECRET_KEY environment variable to enable payments.",
      },
      { status: 503 }
    );
  }

  // Require an authenticated user so the purchase can be tied to an identity.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Not authenticated", message: "Sign in before starting checkout." },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plan: rawPlan, billing = "monthly" } = body as CheckoutRequestBody;
  // Normalize any legacy plan key (pro/single) a cached client might send.
  const plan = rawPlan ? (normalizeTierKey(rawPlan) as PaidTier) : rawPlan;

  if (!plan || !isPaidTier(plan)) {
    return NextResponse.json({ error: `Invalid plan. Must be one of: ${PAID_TIERS.join(", ")}` }, { status: 400 });
  }

  const config = TIER_CONFIG[plan];
  const priceEnv = config.priceEnv?.[billing === "annual" ? "annual" : "monthly"];
  if (!priceEnv) {
    return NextResponse.json({ error: "Plan is not purchasable." }, { status: 400 });
  }
  const priceId = process.env[priceEnv];
  if (!priceId) {
    return NextResponse.json(
      {
        error: "Price not configured",
        message: `Set the ${priceEnv} environment variable to the Stripe Price ID.`,
      },
      { status: 503 }
    );
  }

  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  // First-touch partner attribution: if this buyer arrived via a referral link,
  // record it now (before any subscription invoice) so recurring commissions
  // credit the right partner. Non-fatal — never blocks checkout.
  const referralCode = request.cookies.get("cq_ref")?.value;
  if (referralCode) {
    try {
      await attachReferral(user.id, referralCode);
    } catch {
      /* attribution is best-effort */
    }
  }

  try {
    // Reuse an existing Stripe customer if we have one recorded for this user.
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin
        .from("subscriptions")
        .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard/home?checkout=success`,
      cancel_url: `${origin}/dashboard?checkout=cancelled`,
      metadata: { plan, supabase_user_id: user.id },
      subscription_data: { metadata: { plan, supabase_user_id: user.id } },
    });

    analytics.track({ event: "checkout_started", userId: user.id, properties: { plan, billing } });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    logger.child({ module: "checkout" }).error("Checkout session failed", { userId: user.id, plan, message });
    Sentry.captureException(err, { tags: { module: "checkout" }, extra: { userId: user.id, plan, billing } });
    return NextResponse.json({ error: "Checkout session failed", message }, { status: 500 });
  }
}
