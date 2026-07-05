import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, logger, analytics } from "@/services";
import { isPaidTier, type PaidTier } from "@/lib/pricing";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const log = logger.child({ module: "stripe-webhook" });

type Plan = PaidTier;

/** Accepts current plan keys, mapping the retired "single" key to "pro". */
function toPlan(value: string | undefined): Plan | null {
  if (value === "single") return "pro";
  return value && isPaidTier(value) ? value : null;
}

/**
 * Marks a marketplace purchase paid and bumps the listing's sales counter. Keyed
 * on the checkout session id we recorded when the purchase was created pending.
 */
async function settleMarketplacePurchase(session: Stripe.Checkout.Session) {
  const templateId = session.metadata?.marketplace_template_id;
  const buyerId = session.metadata?.supabase_user_id;
  if (!templateId || !buyerId) {
    log.error("Marketplace session missing metadata", { sessionId: session.id });
    return;
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("marketplace_purchases")
    .update({ status: "paid", stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq("template_id", templateId)
    .eq("buyer_id", buyerId);
  if (error) {
    log.error("Failed to settle marketplace purchase", { sessionId: session.id, error: error.message });
    return;
  }
  await admin.rpc("increment_template_sales", { t_id: templateId });
}

/** Reflects a connected account's charge capability onto the creator profile. */
async function syncConnectedAccount(account: Stripe.Account) {
  const admin = createAdminClient();
  await admin
    .from("marketplace_creators")
    .update({ payouts_enabled: account.charges_enabled === true, updated_at: new Date().toISOString() })
    .eq("stripe_account_id", account.id);
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
    log.error("Could not resolve user for customer", { stripeCustomerId: params.stripeCustomerId });
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
      case "account.updated": {
        await syncConnectedAccount(event.data.object);
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object;

        // Marketplace purchases carry kind=marketplace and settle a purchase row
        // instead of a subscription entitlement.
        if (session.metadata?.kind === "marketplace") {
          await settleMarketplacePurchase(session);
          break;
        }

        const plan = toPlan(session.metadata?.plan);
        const supabaseUserId = session.metadata?.supabase_user_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

        if (customerId && plan) {
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
          await setEntitlement({
            stripeCustomerId: customerId,
            supabaseUserId,
            tier: plan,
            status: "active",
            stripeSubscriptionId: subscriptionId,
          });
          analytics.track({ event: "checkout_completed", userId: supabaseUserId, properties: { plan } });
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object;
        const plan = toPlan(subscription.metadata?.plan);
        const supabaseUserId = subscription.metadata?.supabase_user_id;
        const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
        const active = subscription.status === "active" || subscription.status === "trialing";
        if (plan) {
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
        const supabaseUserId = subscription.metadata?.supabase_user_id;
        await setEntitlement({
          stripeCustomerId: customerId,
          supabaseUserId,
          // Tier is forced to "free" on cancellation; value here is a placeholder.
          tier: "pro",
          status: "canceled",
          stripeSubscriptionId: subscription.id,
        });
        analytics.track({ event: "subscription_canceled", userId: supabaseUserId });
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
    log.error("Webhook handler failed", { eventType: event.type, message });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
