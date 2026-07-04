// Single source for the Stripe SDK client.
//
// Previously getStripe() was duplicated across the checkout, billing-portal, and
// webhook routes. Centralizing it keeps API-version/config consistent and gives
// later phases (metered billing, Connect payouts) one place to extend.

import Stripe from "stripe";

let cached: Stripe | null | undefined;

/**
 * Returns a memoized Stripe client, or null when STRIPE_SECRET_KEY is unset so
 * callers can respond 503 instead of throwing at import time.
 */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

/** Test-only: clears the memoized client so env changes take effect. */
export function resetStripeClientForTests(): void {
  cached = undefined;
}
