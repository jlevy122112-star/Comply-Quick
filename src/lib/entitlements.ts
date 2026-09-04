import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isTier,
  normalizeTierKey,
  organizationPlanToTier,
  TIER_CONFIG,
  type OrganizationPlan,
  type PaidTier,
  type Tier,
} from "@/lib/pricing";
import { getActiveOrganizationId } from "@/lib/organizations-db";

export type { PaidTier, Tier };

export interface Entitlement {
  tier: Tier;
  status: "active" | "inactive" | "past_due" | "canceled";
  isPremium: boolean;
  isEnterprise: boolean;
  currentPeriodEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  limits: {
    seats: number;
    scanLimit: number;
    managedClients: number | null;
  };
}

const DEFAULT_ENTITLEMENT: Entitlement = {
  tier: "free",
  status: "inactive",
  isPremium: false,
  isEnterprise: false,
  currentPeriodEnd: null,
  cancelAt: null,
  canceledAt: null,
  limits: { seats: 1, scanLimit: 1, managedClients: null },
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
    .select("tier, status, current_period_end, cancel_at, canceled_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return DEFAULT_ENTITLEMENT;
  return applyManualOverride(mapEntitlement(data), null);
}

interface SubscriptionRow {
  tier: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at?: string | null;
  canceled_at?: string | null;
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
    cancelAt: data.cancel_at ?? null,
    canceledAt: data.canceled_at ?? null,
    limits: limitsForTier(tier),
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
    .select("tier, status, current_period_end, cancel_at, canceled_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULT_ENTITLEMENT;
  return applyManualOverride(mapEntitlement(data), null);
});

/**
 * Resolves the entitlement for an organization by inheriting its owner's
 * subscription. Billing remains user-scoped; this is the org-aware read facade.
 */
export const getOrgEntitlement = cache(async (organizationId?: string): Promise<Entitlement> => {
  const resolvedOrganizationId = organizationId ?? (await getActiveOrganizationId());
  if (!resolvedOrganizationId) return getEntitlement();

  const admin = createAdminClient();
  const { data: organization } = await admin
    .from("organizations")
    .select("owner_id, plan")
    .eq("id", resolvedOrganizationId)
    .maybeSingle();
  const ownerId = (organization as { owner_id?: string } | null)?.owner_id;
  const organizationPlan = (organization as { plan?: OrganizationPlan } | null)?.plan;
  if (!ownerId) return getEntitlement();
  const { data: orgSubscription } = await admin
    .from("organization_subscriptions")
    .select("tier, status, current_period_end, cancel_at, canceled_at")
    .eq("organization_id", resolvedOrganizationId)
    .maybeSingle();
  const entitlement = orgSubscription
    ? mapEntitlement(orgSubscription)
    : applyOrganizationPlanBaseline(await getEntitlementForUser(ownerId), organizationPlan);
  try {
    const now = new Date().toISOString();
    const { data: override } = await admin
      .from("manual_entitlement_overrides")
      .select("tier, seats, scan_limit, managed_clients")
      .eq("organization_id", resolvedOrganizationId)
      .eq("active", true)
      .lte("effective_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("effective_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return applyManualOverride(entitlement, override);
  } catch {
    // Keep subscription-derived access working before the additive migration is deployed.
    return entitlement;
  }
});

interface ManualOverrideRow {
  tier: string | null;
  seats: number | null;
  scan_limit: number | null;
  managed_clients: number | null;
}

function applyOrganizationPlanBaseline(entitlement: Entitlement, plan?: OrganizationPlan): Entitlement {
  if (!plan) return entitlement;
  const mappedTier = organizationPlanToTier(plan);
  if (entitlement.tier !== "free") return entitlement;
  return {
    ...entitlement,
    tier: mappedTier,
    isPremium: mappedTier !== "free" && entitlement.status === "active",
    isEnterprise: mappedTier === "enterprise" && entitlement.status === "active",
    limits: limitsForTier(mappedTier),
  };
}

function limitsForTier(tier: Tier): Entitlement["limits"] {
  const config = TIER_CONFIG[tier];
  return {
    seats: config.seats,
    scanLimit: config.scanLimit,
    managedClients: config.managedClients,
  };
}

function applyManualOverride(entitlement: Entitlement, override: ManualOverrideRow | null): Entitlement {
  if (!override) return entitlement;
  const normalizedTier = override.tier ? normalizeTierKey(override.tier) : entitlement.tier;
  const tier: Tier = isTier(normalizedTier) ? normalizedTier : entitlement.tier;
  const base = limitsForTier(tier);
  return {
    ...entitlement,
    tier,
    status: "active",
    isPremium: tier !== "free",
    isEnterprise: tier === "enterprise",
    cancelAt: entitlement.cancelAt,
    canceledAt: entitlement.canceledAt,
    limits: {
      seats: override.seats ?? base.seats,
      scanLimit: override.scan_limit ?? base.scanLimit,
      managedClients: override.managed_clients ?? base.managedClients,
    },
  };
}

const TIER_RANK: Record<Tier, number> = { free: 0, solo: 1, agency: 2, enterprise: 3 };

export function tierAtLeast(current: Tier, required: Tier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export function hasPaidAccess(entitlement: Pick<Entitlement, "tier" | "status">): boolean {
  return entitlement.status === "active" && entitlement.tier !== "free";
}
