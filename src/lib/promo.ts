// Launch promotions — single source of truth, committed to the repo so the
// coupon codes are versioned and never lost.

/**
 * Founding 100: the first {@link FOUNDING_MEMBER_LIMIT} signups receive a free
 * premium scan, redeemable with {@link FOUNDING_COUPON_CODE}. The lead-capture
 * flow flags qualifying signups and surfaces the code in their welcome email.
 */
export const FOUNDING_MEMBER_LIMIT = 100;
export const FOUNDING_COUPON_CODE = "FOUNDING100";

/** Human-readable description of what the founding coupon unlocks. */
export const FOUNDING_COUPON_REWARD = "a free premium scan";
