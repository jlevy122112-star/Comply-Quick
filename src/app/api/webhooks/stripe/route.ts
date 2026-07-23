import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, logger, analytics } from "@/services";
import { isPaidTier, normalizeTierKey, type PaidTier, type Tier } from "@/lib/pricing";
import { recordReferralCommission } from "@/lib/partners/service";
import { createSystemAuditLog } from "@/lib/audit/service";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

const log = logger.child({ module: "stripe-webhook" });

type Plan = PaidTier;

/** Accepts current plan keys, mapping the retired "pro"/"single" keys to "solo". */
function toPlan(value: string | undefined): Plan | null {
  if (!value) return null;
  const normalized = normalizeTierKey(value);
  return isPaidTier(normalized) ? normalized : null;
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
  // Idempotency: only a row still `pending` is transitioned to `paid`, and we
  // bump the sales counter solely when that transition actually happens. A
  // redelivered checkout.session.completed finds the row already `paid`, updates
  // nothing, and therefore does not double-count the sale.
  const { data: settled, error } = await admin
    .from("marketplace_purchases")
    .update({ status: "paid", stripe_session_id: session.id, updated_at: new Date().toISOString() })
    .eq("template_id", templateId)
    .eq("buyer_id", buyerId)
    .eq("status", "pending")
    .select("id");
  if (error) {
    log.error("Failed to settle marketplace purchase", { sessionId: session.id, error: error.message });
    return;
  }
  if (!settled || settled.length === 0) {
    log.info("Marketplace purchase already settled; skipping sales increment", { sessionId: session.id });
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
  // The same connected account may belong to a partner (referral payouts).
  await admin
    .from("partners")
    .update({ payouts_enabled: account.charges_enabled === true, updated_at: new Date().toISOString() })
    .eq("stripe_account_id", account.id);
}

/**
 * Accrues a partner referral commission for a paid subscription invoice. Fires
 * on every billing cycle (invoice.payment_succeeded), which is what makes the
 * 30% share recurring. No-op unless the paying customer was referred; idempotent
 * on the invoice id inside recordReferralCommission.
 */
async function accrueReferralCommission(invoice: Stripe.Invoice) {
  const reason = invoice.billing_reason ?? "";
  if (!reason.startsWith("subscription")) return; // ignore one-off / marketplace invoices
  if (!invoice.id || (invoice.amount_paid ?? 0) <= 0) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  // Resolve the paying user from the customer id we recorded at checkout.
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!data?.user_id) return;

  await recordReferralCommission({
    referredUserId: data.user_id,
    stripeInvoiceId: invoice.id,
    grossCents: invoice.amount_paid,
    currency: invoice.currency ?? "usd",
  });
}

/**
 * Persists a user's entitlement based on Stripe events. Uses the service-role
 * client to write past RLS. The user is resolved via the Stripe customer id or
 * the supabase_user_id metadata we attach at checkout.
 */
async function setEntitlement(params: {
  stripeCustomerId: string;
  supabaseUserId?: string;
  // Optional: a cancellation always resolves to the free tier, so callers on the
  // cancellation path omit it rather than passing a meaningless placeholder.
  tier?: Plan;
  status: "active" | "canceled" | "past_due";
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: number | null;
}) {
  const admin = createAdminClient();

  // Cancellation downgrades to free; every other status must name a paid tier.
  const effectiveTier: Tier = params.status === "canceled" ? "free" : (params.tier ?? "free");
  if (params.status !== "canceled" && !params.tier) {
    throw new Error(`setEntitlement: missing tier for status "${params.status}"`);
  }

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
    // Throw (not silent return) so the webhook responds non-2xx, Stripe retries,
    // and Sentry captures it. A charged customer with no entitlement is a
    // revenue-affecting failure that must never be swallowed.
    throw new Error(`setEntitlement: could not resolve user for customer ${params.stripeCustomerId}`);
  }

  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      tier: effectiveTier,
      status: params.status === "canceled" ? "canceled" : params.status,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId ?? null,
      current_period_end: params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  // Surface write failures instead of swallowing them: a rejected upsert (e.g. a
  // tier the DB constraint doesn't allow) previously left the account on Free
  // while Stripe saw a 200 and never retried. Throwing propagates to the POST
  // handler, which returns 500 so Stripe retries and Sentry records it.
  if (error) {
    throw new Error(`setEntitlement: failed to persist entitlement for user ${userId}: ${error.message}`);
  }
}

/** Formats a Stripe minor-unit amount (e.g. cents) as a currency string. */
function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "unknown";
  const value = amount / 100;
  const code = (currency ?? "usd").toUpperCase();
  return `${value.toFixed(2)} ${code}`;
}

function customerIdOf(customer: string | { id: string } | null | undefined): string | undefined {
  if (!customer) return undefined;
  return typeof customer === "string" ? customer : customer.id;
}

async function userIdForCustomer(customerId: string): Promise<string | undefined> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? undefined;
}

async function syncOrganizationInvoice(invoice: Stripe.Invoice, eventType: string): Promise<boolean> {
  if (!invoice.id) return false;
  const admin = createAdminClient();
  const { data: local } = await admin
    .from("invoices")
    .select("id, organization_id, status")
    .eq("stripe_invoice_id", invoice.id)
    .maybeSingle();
  if (!local) return false;
  const status =
    eventType === "invoice.paid"
      ? "paid"
      : eventType === "invoice.payment_failed"
        ? "open"
        : eventType === "invoice.finalized"
          ? "open"
          : local.status;
  const patch = {
    status,
    amount_paid_cents: invoice.amount_paid ?? 0,
    stripe_invoice_status: invoice.status ?? null,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    issued_at: eventType === "invoice.finalized" ? new Date().toISOString() : undefined,
    paid_at: eventType === "invoice.paid" ? new Date().toISOString() : undefined,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("invoices").update(patch).eq("id", local.id);
  if (error) throw new Error(`Failed to sync organization invoice ${invoice.id}: ${error.message}`);
  await createSystemAuditLog({
    eventType: eventType === "invoice.paid" ? "INVOICE_PAID" : "INVOICE_STATUS_CHANGED",
    actorType: "SYSTEM",
    organizationId: local.organization_id,
    targetResource: `organization/${local.organization_id}/billing/invoice/${local.id}`,
    details: {
      invoiceId: local.id,
      stripeInvoiceId: invoice.id,
      status,
      amountPaidCents: invoice.amount_paid ?? 0,
      stripeEvent: eventType,
    },
  });
  return true;
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
    log.error("Webhook signature verification failed", { message });
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
          // No tier needed: a cancellation always resolves to the free tier.
          status: "canceled",
          stripeSubscriptionId: subscription.id,
        });
        analytics.track({ event: "subscription_canceled", userId: supabaseUserId });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (await syncOrganizationInvoice(invoice, "invoice.paid")) break;
        await accrueReferralCommission(invoice);
        const customer = customerIdOf(invoice.customer);
        if (customer) {
          const admin = createAdminClient();
          const { data: previous } = await admin
            .from("subscriptions")
            .select("status")
            .eq("stripe_customer_id", customer)
            .maybeSingle();
          await admin
            .from("subscriptions")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("stripe_customer_id", customer);
          if (previous?.status === "past_due") {
            analytics.track({
              event: "dunning_payment_recovered",
              userId: await userIdForCustomer(customer),
              properties: { invoice: invoice.id ?? undefined },
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (await syncOrganizationInvoice(invoice, "invoice.payment_failed")) break;
        const customer = customerIdOf(invoice.customer);
        if (customer) {
          const admin = createAdminClient();
          await admin
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("stripe_customer_id", customer);
          analytics.track({
            event: "dunning_payment_failed",
            userId: await userIdForCustomer(customer),
            properties: { invoice: invoice.id ?? undefined, attempt: invoice.attempt_count ?? 0 },
          });
        }
        const amount = formatAmount(invoice.amount_due, invoice.currency);
        log.warn("Invoice payment failed", {
          customer,
          amount,
          attempt: invoice.attempt_count,
          invoice: invoice.id,
        });
        break;
      }

      case "invoice.finalized": {
        await syncOrganizationInvoice(event.data.object, "invoice.finalized");
        break;
      }

      case "invoice.paid": {
        await syncOrganizationInvoice(event.data.object, "invoice.paid");
        break;
      }

      case "charge.failed": {
        const charge = event.data.object;
        const customer = customerIdOf(charge.customer);
        const amount = formatAmount(charge.amount, charge.currency);
        log.warn("Charge failed", {
          customer,
          amount,
          reason: charge.failure_code ?? charge.failure_message,
          charge: charge.id,
        });
        break;
      }

      default:
        break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler error";
    log.error("Webhook handler failed", { eventType: event.type, message });
    Sentry.captureException(err, { tags: { module: "stripe-webhook", eventType: event.type } });
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
