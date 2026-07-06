// Pricing source of truth for the Compliance OS.
//
// `TIER_CONFIG` is the single canonical definition of every subscription tier —
// price, included seats, and monthly scan allotment. Feature modules (agency
// billing, freemium funnel, metered API) read from here so limits and prices
// never drift between the checkout, the webhook, the paywall, and the UI.
//
// Pricing decisions (owner-approved 2026-07-06 — value-based repricing):
//   • Solo (machine key `pro`): $29/mo, 20 scans — freelancers / solo devs.
//   • Agency: $99/mo, 5 seats, 100 scans — the primary ICP (monitoring +
//     Autopilot + white-label).
//   • Enterprise: $299/mo, unlimited seats + scans — regulated industries.
//   • Free tier stays capped at 1 scan / month (freemium funnel hook).
//   • Machine keys (free/pro/agency/enterprise) are UNCHANGED so persisted
//     entitlements keep working; only labels, prices, and limits changed.
//   • Annual = 10× monthly (~2 months free). New Stripe Price IDs must be
//     created and wired via the STRIPE_PRICE_* env vars; existing subscribers
//     are grandfathered on their old Stripe prices.
//
// Unlimited values are represented by `Infinity` (never a magic -1 at call
// sites): `seats: Infinity` / `scanLimit: Infinity` for Enterprise.

export type PaidTier = "pro" | "agency" | "enterprise";
export type Tier = "free" | PaidTier;

export type Billing = "monthly" | "annual";

export interface TierConfig {
  /** Stable machine key (matches the entitlement tier persisted by Stripe). */
  id: Tier;
  /** Human-facing plan name. */
  label: string;
  /** Monthly price in whole US dollars. */
  monthly: number;
  /** Annual price in whole US dollars (billed once per year). */
  annual: number;
  /** Included member seats. `Infinity` = unlimited (Enterprise). */
  seats: number;
  /** Included compliance scans per calendar month. `Infinity` = unlimited. */
  scanLimit: number;
  /** Stripe checkout mode. Free has no checkout. */
  mode: "subscription" | "none";
  /**
   * Env var names holding the Stripe Price IDs for each cadence. Absent for the
   * free tier. Kept here so checkout resolves prices from the tier config alone.
   */
  priceEnv?: Record<Billing, string>;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  free: {
    id: "free",
    label: "Free",
    monthly: 0,
    annual: 0,
    seats: 1,
    scanLimit: 1,
    mode: "none",
  },
  pro: {
    id: "pro",
    label: "Solo",
    monthly: 29,
    annual: 290,
    seats: 1,
    scanLimit: 20,
    mode: "subscription",
    priceEnv: { monthly: "STRIPE_PRICE_PRO_MONTHLY", annual: "STRIPE_PRICE_PRO_ANNUAL" },
  },
  agency: {
    id: "agency",
    label: "Agency",
    monthly: 99,
    annual: 990,
    seats: 5,
    scanLimit: 100,
    mode: "subscription",
    priceEnv: { monthly: "STRIPE_PRICE_AGENCY", annual: "STRIPE_PRICE_AGENCY_ANNUAL" },
  },
  enterprise: {
    id: "enterprise",
    label: "Enterprise",
    monthly: 299,
    annual: 2990,
    seats: Infinity,
    scanLimit: Infinity,
    mode: "subscription",
    priceEnv: { monthly: "STRIPE_PRICE_ENTERPRISE", annual: "STRIPE_PRICE_ENTERPRISE_ANNUAL" },
  },
};

/**
 * Metered add-on prices (usage-based expansion revenue). These are charged on
 * top of the base subscription once the plan's included allotment is exceeded.
 * The $50 template-upload charge applies to **API/programmatic uploads only** —
 * Creator-Studio marketplace listings remain free to publish.
 */
export const METERED_PRICE_CENTS = {
  /** Per API call beyond the plan's monthly allotment. */
  apiCall: 1, // $0.01
  /** Per compliance scan beyond the plan's monthly scanLimit. */
  extraScan: 500, // $5.00
  /** Per template uploaded via the API (not the marketplace UI). */
  apiTemplateUpload: 5000, // $50.00
} as const;

export const PAID_TIERS: PaidTier[] = ["pro", "agency", "enterprise"];
export const ALL_TIERS: Tier[] = ["free", ...PAID_TIERS];

export function isPaidTier(value: string): value is PaidTier {
  return (PAID_TIERS as string[]).includes(value);
}

export function isTier(value: string): value is Tier {
  return (ALL_TIERS as string[]).includes(value);
}

export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIG[tier];
}

/** Included seats for a tier (`Infinity` for Enterprise). */
export function seatLimit(tier: Tier): number {
  return TIER_CONFIG[tier].seats;
}

/** Included monthly scans for a tier (`Infinity` for Enterprise). */
export function scanLimit(tier: Tier): number {
  return TIER_CONFIG[tier].scanLimit;
}

/** Whether a tier has an unlimited allotment for the given resource. */
export function isUnlimited(value: number): boolean {
  return value === Infinity;
}
