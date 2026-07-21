import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTier, normalizeTierKey, type PaidTier, type Tier } from "@/lib/pricing";
import { getActiveOrganizationId } from "@/lib/organizations-db";

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
  // Legacy rows may still carry the retired "pro"/"single" keys — normalize to "solo".
  const rawTier = normalizeTierKey(data.tier ?? "free");
  const tier: Tier = isTier(rawTier) ? rawTier : "free";
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
export const getEntitlementForUser = cache(async (userId: string): Promise<Entitlement> => {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULT_ENTITLEMENT;
  return mapEntitlement(data);
});

/**
 * Resolves the entitlement for an organization by inheriting its owner's
 * subscription. Billing remains user-scoped; this is the org-aware read facade.
 */
export const getOrgEntitlement = cache(async (organizationId?: string): Promise<Entitlement> => {
  const resolvedOrganizationId = organizationId ?? (await getActiveOrganizationId());
  if (!resolvedOrganizationId) return getEntitlement();

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("owner_id")
    .eq("id", resolvedOrganizationId)
    .maybeSingle();
  const ownerId = (organization as { owner_id?: string } | null)?.owner_id;
  return ownerId ? getEntitlementForUser(ownerId) : getEntitlement();
});
