import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

function getStripe(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

interface CheckoutRequestBody {
  plan: "single" | "agency" | "enterprise";
}

const PLAN_CONFIG: Record<string, { name: string; priceInCents: number; mode: "payment" | "subscription" }> = {
  single: {
    name: "Comply-Quick — Single Project Pass",
    priceInCents: 1200,
    mode: "payment",
  },
  agency: {
    name: "Comply-Quick — Agency Scale Plan",
    priceInCents: 2900,
    mode: "subscription",
  },
  enterprise: {
    name: "Comply-Quick — Enterprise Tier",
    priceInCents: 9900,
    mode: "subscription",
  },
};

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { plan } = body as CheckoutRequestBody;

  if (!plan || !PLAN_CONFIG[plan]) {
    return NextResponse.json(
      { error: "Invalid plan. Must be one of: single, agency, enterprise" },
      { status: 400 }
    );
  }

  const config = PLAN_CONFIG[plan];
  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: config.name },
            unit_amount: config.priceInCents,
            ...(config.mode === "subscription" ? { recurring: { interval: "month" } } : {}),
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?status=success&plan=${plan}`,
      cancel_url: `${origin}/dashboard?status=cancelled`,
      metadata: { plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: "Checkout session failed", message }, { status: 500 });
  }
}
