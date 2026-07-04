import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

function getStripe(): Stripe | null {
  if (!stripeSecretKey) return null;
  return new Stripe(stripeSecretKey);
}

type Plan = "single" | "agency" | "enterprise";

function isPlan(value: string | undefined): value is Plan {
  return value === "single" || value === "agency" || value === "enterprise";
}

/**
 * Persists a user's entitlement based on Stripe events. Uses the service-role
 * client to write past RLS. The user is resolved via the Stripe customer id or
 * the supabase_user_id metadata we attach at checkout.
 */
async function setEntitlement(params: {
  stripeCustomerId: string;
  supabaseUserId?: string;
  tier: Plan;
  status: "active" | "canceled" | "past_due";
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
}) {
  const admin = createAdminClient();

  let userId = params.supabaseUserId;
  if (!userId) {
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", params.stripeCustomerId)
      .maybeSingle();
    userId = data?.user_id ?? undefined;
  }
  if (!userId) {
    console.error(`[Stripe] Could not resolve user for customer ${params.stripeCustomerId}`);
    return;
  }

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: params.status === "canceled" ? "free" : params.tier,
      status: params.status === "canceled" ? "canceled" : params.status,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      current_period_end: params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const plan = session.metadata?.plan;
        const supabaseUserId = session.metadata?.supabase_user_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (customerId && isPlan(plan)) {
          // One-time (single) purchases have no subscription; mark active immediately.
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
          await setEntitlement({
            stripeCustomerId: customerId,
            supabaseUserId,
            tier: plan,
            status: "active",
            stripeSubscriptionId: subscriptionId,
          });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object;
        const plan = subscription.metadata?.plan;
        const supabaseUserId = subscription.metadata?.supabase_user_id;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const active = subscription.status === "active" || subscription.status === "trialing";
        if (isPlan(plan)) {
          await setEntitlement({
            stripeCustomerId: customerId,
            supabaseUserId,
            tier: plan,
            status: active ? "active" : subscription.status === "past_due" ? "past_due" : "canceled",
            stripeSubscriptionId: subscription.id,
            currentPeriodEnd: subscription.items.data[0]?.current_period_end ?? null,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        await setEntitlement({
          stripeCustomerId: customerId,
          tier: "single",
          status: "canceled",
          stripeSubscriptionId: subscription.id,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (customerId) {
          const admin = createAdminClient();
          await admin
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_customer_id", customerId);
        }
        break;
      }

      default:
        break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler error";
    console.error(`[Stripe] ${event.type} handler failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
