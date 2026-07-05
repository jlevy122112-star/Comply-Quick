import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTier, type PaidTier, type Tier } from "@/lib/pricing";

export type { PaidTier, Tier };

export interface Entitlement {
  tier: Tier;
  status: "active" | "inactive" | "past_due" | "canceled";
  isPremium: boolean;
  isEnterprise: boolean;
  currentPeriodEnd: string | null;
}

const DEFAULT_ENTITLEMENT: Entitlement = {
  tier: "free",
  status: "inactive",
  isPremium: false,
  isEnterprise: false,
  currentPeriodEnd: null,
};

/**
 * Server-side source of truth for a user's paid access. Reads the subscriptions
 * row (written by the Stripe webhook) rather than trusting any client flag.
 * Returns the free/inactive default when unauthenticated or unpaid.
 */
export async function getEntitlement(): Promise<Entitlement> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return DEFAULT_ENTITLEMENT;

  const { data, error } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return DEFAULT_ENTITLEMENT;
  return mapEntitlement(data);
}

interface SubscriptionRow {
  tier: string | null;
  status: string | null;
  current_period_end: string | null;
}

/** Translates a raw subscriptions row into a typed entitlement. */
function mapEntitlement(data: SubscriptionRow): Entitlement {
  const rawTier = data.tier ?? "free";
  // Legacy rows may still carry the retired "single" key — map it to "pro".
  const tier: Tier = rawTier === "single" ? "pro" : isTier(rawTier) ? rawTier : "free";
  const status = (data.status ?? "inactive") as Entitlement["status"];
  const isPremium = status === "active" && tier !== "free";
  const isEnterprise = isPremium && tier === "enterprise";

  return {
    tier,
    status,
    isPremium,
    isEnterprise,
    currentPeriodEnd: data.current_period_end ?? null,
  };
}

/**
 * Entitlement for an arbitrary user id, resolved with the service-role client.
 * Used by the metered API layer, where the request is authenticated by API key
 * and has no Supabase session to read auth.uid() from.
 */
export async function getEntitlementForUser(userId: string): Promise<Entitlement> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULT_ENTITLEMENT;
  return mapEntitlement(data);
}
