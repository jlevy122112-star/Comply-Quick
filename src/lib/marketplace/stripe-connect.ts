// Stripe Connect glue for the marketplace (Phase 6).
//
// Sellers onboard as Stripe Express connected accounts; buyers pay via a
// destination charge on the platform account, and Stripe transfers the net
// (price − application fee) to the seller. Purchase rows are written with the
// service-role client because the buyer has no insert policy on purchases.
//
// Everything degrades gracefully when Stripe is unconfigured (getStripe() null):
// callers surface a 503 rather than throwing at import.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, logger } from "@/services";
import { UnauthorizedError, NotFoundError, ValidationError, ForbiddenError } from "@/services/errors";
import { getOrCreateCreator, getMyCreator, platformFeeCents, type Creator } from "./service";

const log = logger.child({ module: "marketplace-connect" });

/** True when Stripe is configured (a secret key is present). */
export function isConnectConfigured(): boolean {
  return getStripe() !== null;
}

/**
 * Ensures the caller's creator profile has a connected Stripe account and returns
 * an onboarding link. Sending them through the link (and back) is what flips
 * `payouts_enabled` once Stripe reports the account can accept charges.
 */
export async function getConnectOnboardingLink(origin: string): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new ValidationError("Payments are not configured.");

  const creator = await getOrCreateCreator();
  let accountId = creator.stripeAccountId;

  if (!accountId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      metadata: { creator_id: creator.id, supabase_user_id: user.id },
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    // RLS allows the owner to update their own creator row.
    await supabase
      .from("marketplace_creators")
      .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
      .eq("id", creator.id);
    log.info("Created connected account", { creatorId: creator.id, accountId });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/marketplace/creator?connect=refresh`,
    return_url: `${origin}/dashboard/marketplace/creator?connect=done`,
    type: "account_onboarding",
  });
  return { url: link.url };
}

/**
 * Starts a purchase. Free templates are granted immediately; paid templates
 * return a Stripe Checkout URL configured as a destination charge to the
 * seller's connected account with the platform application fee retained.
 */
export async function startTemplateCheckout(
  templateId: string,
  origin: string
): Promise<{ url?: string; claimed?: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  // Read the listing (RLS: must be published) plus the seller's payout account.
  const { data: row } = await supabase
    .from("marketplace_templates")
    .select(
      "id, title, price_cents, currency, status, creator_id, marketplace_creators!inner(stripe_account_id, payouts_enabled, user_id)"
    )
    .eq("id", templateId)
    .eq("status", "published")
    .maybeSingle();
  if (!row) throw new NotFoundError("Template not found.");

  const rec = row as Record<string, unknown>;
  const creator = rec.marketplace_creators as {
    stripe_account_id: string | null;
    payouts_enabled: boolean;
    user_id: string;
  };
  if (creator.user_id === user.id) throw new ValidationError("You can't purchase your own template.");

  const priceCents = (rec.price_cents as number) ?? 0;
  const currency = (rec.currency as string) ?? "usd";
  const admin = createAdminClient();

  // Free template: grant immediately, no Stripe round-trip.
  if (priceCents === 0) {
    await admin.from("marketplace_purchases").upsert(
      {
        template_id: templateId,
        buyer_id: user.id,
        amount_cents: 0,
        platform_fee_cents: 0,
        currency,
        status: "paid",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "template_id,buyer_id" }
    );
    await admin.rpc("increment_template_sales", { t_id: templateId }).then(
      () => undefined,
      () => undefined // RPC is best-effort; absence shouldn't block the grant.
    );
    return { claimed: true };
  }

  const stripe = getStripe();
  if (!stripe) throw new ValidationError("Payments are not configured.");
  if (!creator.stripe_account_id || !creator.payouts_enabled) {
    throw new ForbiddenError("This seller hasn't finished setting up payouts yet.");
  }

  const fee = platformFeeCents(priceCents);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: priceCents,
          product_data: { name: (rec.title as string) ?? "Compliance template" },
        },
      },
    ],
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: creator.stripe_account_id },
    },
    success_url: `${origin}/dashboard/marketplace?purchase=success`,
    cancel_url: `${origin}/dashboard/marketplace?purchase=cancelled`,
    metadata: { kind: "marketplace", marketplace_template_id: templateId, supabase_user_id: user.id },
  });

  // Record the intent as pending; the webhook flips it to paid.
  await admin.from("marketplace_purchases").upsert(
    {
      template_id: templateId,
      buyer_id: user.id,
      amount_cents: priceCents,
      platform_fee_cents: fee,
      currency,
      stripe_session_id: session.id,
      status: "pending",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "template_id,buyer_id" }
  );

  return { url: session.url ?? undefined };
}

/** Whether the caller has a connected account that can accept payouts. */
export async function getPayoutStatus(): Promise<{
  connected: boolean;
  payoutsEnabled: boolean;
  creator: Creator | null;
}> {
  const creator = await getMyCreator();
  return {
    connected: Boolean(creator?.stripeAccountId),
    payoutsEnabled: Boolean(creator?.payoutsEnabled),
    creator,
  };
}
