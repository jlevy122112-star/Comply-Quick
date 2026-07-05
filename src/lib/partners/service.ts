// Partner Program server service (Phase 8 / [Up8]).
//
// Anyone can join the partner program to earn a recurring 30% share of every
// subscription payment made by a customer they referred. Attribution is
// first-touch (partner_referrals is unique per referred user) and commissions
// accrue per paid Stripe invoice (idempotent on the invoice id). Referral rows
// and commission rows are written by the checkout route / Stripe webhook via the
// service-role client, since neither the referred buyer nor the partner may
// forge attributions under RLS.

import { randomBytes } from "node:crypto";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/services";
import { UnauthorizedError } from "@/services/errors";

const log = logger.child({ module: "partners" });

/** Partner's recurring share of every referred subscription payment. */
export const PARTNER_COMMISSION_RATE = 0.3;

/** The partner's commission (in cents) for a gross payment of `grossCents`. */
export function partnerCommissionCents(grossCents: number): number {
  return Math.round(grossCents * PARTNER_COMMISSION_RATE);
}

export interface Partner {
  id: string;
  userId: string;
  referralCode: string;
  stripeAccountId: string | null;
  payoutsEnabled: boolean;
  createdAt: string;
}

export interface PartnerCommission {
  id: string;
  grossCents: number;
  commissionCents: number;
  currency: string;
  status: "accrued" | "paid";
  createdAt: string;
}

export interface PartnerDashboard {
  partner: Partner;
  referredCustomers: number;
  earnings: {
    /** Lifetime commission earned (accrued + paid), in cents. */
    totalCents: number;
    /** Owed but not yet paid out, in cents. */
    accruedCents: number;
    /** Already transferred out, in cents. */
    paidCents: number;
    currency: string;
  };
  commissions: PartnerCommission[];
}

function mapPartner(row: Record<string, unknown>): Partner {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    referralCode: row.referral_code as string,
    stripeAccountId: (row.stripe_account_id as string | null) ?? null,
    payoutsEnabled: Boolean(row.payouts_enabled),
    createdAt: row.created_at as string,
  };
}

const PARTNER_COLS = "id, user_id, referral_code, stripe_account_id, payouts_enabled, created_at";

/** URL-safe, unguessable referral code (~11 chars of base64url entropy). */
function generateReferralCode(): string {
  return randomBytes(8).toString("base64url");
}

/** The caller's partner profile, or null if they haven't joined the program. */
export const getMyPartner = cache(async (): Promise<Partner | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  const { data } = await supabase.from("partners").select(PARTNER_COLS).eq("user_id", user.id).maybeSingle();
  return data ? mapPartner(data) : null;
});

/** Ensures the caller has a partner profile (with a referral code) and returns it. */
export async function getOrCreatePartner(): Promise<Partner> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const existing = await getMyPartner();
  if (existing) return existing;

  const { data, error } = await supabase
    .from("partners")
    .insert({ user_id: user.id, referral_code: generateReferralCode() })
    .select(PARTNER_COLS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to join the partner program.");
  log.info("Partner joined", { partnerId: data.id });
  return mapPartner(data);
}

/**
 * Records first-touch referral attribution for a newly-referred user. No-op if
 * the code is unknown, the user is self-referring, or the user is already
 * attributed to a partner. Uses the service-role client because the referred
 * buyer has no insert policy on partner_referrals.
 */
export async function attachReferral(referredUserId: string, referralCode: string): Promise<void> {
  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("partners")
    .select("id, user_id")
    .eq("referral_code", referralCode)
    .maybeSingle();
  if (!partner) return; // unknown code
  if (partner.user_id === referredUserId) return; // self-referral

  // First touch wins: ignore if this user is already attributed.
  const { data: existing } = await admin
    .from("partner_referrals")
    .select("id")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();
  if (existing) return;

  const { error } = await admin
    .from("partner_referrals")
    .insert({ partner_id: partner.id, referred_user_id: referredUserId });
  if (error) log.error("Failed to attach referral", { referredUserId, error: error.message });
  else log.info("Referral attached", { partnerId: partner.id, referredUserId });
}

/**
 * Accrues a partner commission for a paid subscription invoice. Looks up the
 * partner who referred the paying user; no-op if the user wasn't referred.
 * Idempotent on `stripeInvoiceId` (a unique constraint), so webhook replays and
 * duplicate deliveries never double-credit. Service-role only.
 */
export async function recordReferralCommission(params: {
  referredUserId: string;
  stripeInvoiceId: string;
  grossCents: number;
  currency?: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: referral } = await admin
    .from("partner_referrals")
    .select("partner_id")
    .eq("referred_user_id", params.referredUserId)
    .maybeSingle();
  if (!referral) return; // user wasn't referred by anyone

  const commissionCents = partnerCommissionCents(params.grossCents);
  const { error } = await admin.from("partner_commissions").insert({
    partner_id: referral.partner_id,
    referred_user_id: params.referredUserId,
    stripe_invoice_id: params.stripeInvoiceId,
    gross_cents: params.grossCents,
    commission_cents: commissionCents,
    currency: params.currency ?? "usd",
  });
  // Unique-violation (23505) means we already recorded this invoice — expected
  // on webhook replay, not an error.
  if (error && error.code !== "23505") {
    log.error("Failed to record commission", { stripeInvoiceId: params.stripeInvoiceId, error: error.message });
  } else if (!error) {
    log.info("Commission accrued", { partnerId: referral.partner_id, commissionCents });
  }
}

/** Aggregated partner dashboard: referred customers, earnings, commission ledger. */
export async function getPartnerDashboard(): Promise<PartnerDashboard | null> {
  const partner = await getMyPartner();
  if (!partner) return null;

  const supabase = await createClient();
  const [{ count: referredCustomers }, { data: commissionRows }] = await Promise.all([
    supabase.from("partner_referrals").select("id", { count: "exact", head: true }).eq("partner_id", partner.id),
    supabase
      .from("partner_commissions")
      .select("id, gross_cents, commission_cents, currency, status, created_at")
      .eq("partner_id", partner.id)
      .order("created_at", { ascending: false }),
  ]);

  const commissions: PartnerCommission[] = (commissionRows ?? []).map((r) => ({
    id: r.id as string,
    grossCents: (r.gross_cents as number) ?? 0,
    commissionCents: (r.commission_cents as number) ?? 0,
    currency: (r.currency as string) ?? "usd",
    status: (r.status as "accrued" | "paid") ?? "accrued",
    createdAt: r.created_at as string,
  }));

  const accruedCents = commissions.filter((c) => c.status === "accrued").reduce((s, c) => s + c.commissionCents, 0);
  const paidCents = commissions.filter((c) => c.status === "paid").reduce((s, c) => s + c.commissionCents, 0);

  return {
    partner,
    referredCustomers: referredCustomers ?? 0,
    earnings: {
      totalCents: accruedCents + paidCents,
      accruedCents,
      paidCents,
      currency: commissions[0]?.currency ?? "usd",
    },
    commissions,
  };
}
