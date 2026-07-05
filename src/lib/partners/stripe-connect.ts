// Stripe Connect glue for the partner program (Phase 8 / [Up8]).
//
// Partners onboard as Stripe Express connected accounts so accrued referral
// commissions can be paid out to them. Mirrors the marketplace's Connect model.
// Everything degrades gracefully when Stripe is unconfigured (getStripe() null):
// callers surface a friendly error rather than throwing at import.

import { createClient } from "@/lib/supabase/server";
import { getStripe, logger } from "@/services";
import { UnauthorizedError, ValidationError } from "@/services/errors";
import { getOrCreatePartner, getMyPartner } from "./service";

const log = logger.child({ module: "partner-connect" });

/** True when Stripe is configured (a secret key is present). */
export function isConnectConfigured(): boolean {
  return getStripe() !== null;
}

/**
 * Ensures the caller's partner profile has a connected Stripe account and
 * returns an onboarding link. Completing the link flips `payouts_enabled` once
 * Stripe reports the account can receive transfers (via the account.updated
 * webhook).
 */
export async function getPartnerConnectOnboardingLink(origin: string): Promise<{ url: string }> {
  const stripe = getStripe();
  if (!stripe) throw new ValidationError("Payouts are not configured.");

  const partner = await getOrCreatePartner();
  let accountId = partner.stripeAccountId;

  if (!accountId) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new UnauthorizedError();

    const account = await stripe.accounts.create({
      type: "express",
      email: user.email ?? undefined,
      metadata: { partner_id: partner.id, supabase_user_id: user.id },
      capabilities: { transfers: { requested: true } },
    });
    accountId = account.id;
    await supabase
      .from("partners")
      .update({ stripe_account_id: accountId, updated_at: new Date().toISOString() })
      .eq("id", partner.id);
    log.info("Created partner connected account", { partnerId: partner.id, accountId });
  }

  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/dashboard/partners?connect=refresh`,
    return_url: `${origin}/dashboard/partners?connect=done`,
    type: "account_onboarding",
  });
  return { url: link.url };
}

/** Whether the caller has a connected account that can receive payouts. */
export async function getPartnerPayoutStatus(): Promise<{ connected: boolean; payoutsEnabled: boolean }> {
  const partner = await getMyPartner();
  return {
    connected: Boolean(partner?.stripeAccountId),
    payoutsEnabled: Boolean(partner?.payoutsEnabled),
  };
}
