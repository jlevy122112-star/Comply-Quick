import { createClient } from "@/lib/supabase/server";

export type PaidTier = "single" | "agency" | "enterprise";
export type Tier = "free" | PaidTier;

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

  const tier = (data.tier ?? "free") as Tier;
  const status = (data.status ?? "inactive") as Entitlement["status"];
  // "single" is a one-time purchase — treat as active regardless of period end.
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
