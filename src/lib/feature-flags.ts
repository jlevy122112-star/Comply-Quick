import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/organizations-db";
import type { Organization } from "@/lib/organizations";
import type { Tier } from "@/lib/pricing";

/** Maps the organizations.plan column to the billing/entitlement tier model. */
function orgPlanToTier(plan: Organization["plan"]): Tier {
  if (plan === "team") return "solo";
  return plan;
}

export type FeatureFlag =
  | "agencyPortal"
  | "enterpriseHierarchy"
  | "sso"
  | "scim"
  | "whiteLabel"
  | "customSmtp"
  | "siemExport"
  | "auditStreaming"
  | "backgroundJobs"
  | "mlRiskScoring";

interface FeatureDefinition {
  name: string;
  description: string;
  defaultForTier: (tier: Tier) => boolean;
}

/** Product feature registry. Defaults are tier-driven; overrides are per-tenant. */
const FEATURES: Record<FeatureFlag, FeatureDefinition> = {
  agencyPortal: {
    name: "Agency portal",
    description: "Client accounts, domains, and portfolio analytics.",
    defaultForTier: (tier) => tier !== "free",
  },
  enterpriseHierarchy: {
    name: "Organization hierarchy",
    description: "Nested sub-organizations for regions, departments, and agencies.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  sso: {
    name: "Single sign-on",
    description: "SAML / OIDC SSO connections.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  scim: {
    name: "SCIM provisioning",
    description: "Automated user provisioning via SCIM.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  whiteLabel: {
    name: "White-label",
    description: "Custom logos, colors, and domains.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  customSmtp: {
    name: "Custom SMTP",
    description: "Per-tenant outbound email configuration.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  siemExport: {
    name: "SIEM export",
    description: "Export audit and compliance events to external SIEMs.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  auditStreaming: {
    name: "Audit streaming",
    description: "Real-time audit event streaming.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  backgroundJobs: {
    name: "Background jobs",
    description: "Durable, monitored background processing.",
    defaultForTier: (tier) => tier === "enterprise",
  },
  mlRiskScoring: {
    name: "ML risk scoring",
    description: "Predictive compliance and security risk scores.",
    defaultForTier: (tier) => tier === "enterprise",
  },
};

export const FEATURE_FLAG_KEYS = Object.keys(FEATURES) as FeatureFlag[];

/** Computes effective value for a feature given the org's plan and an override. */
export function isFeatureEnabled(flag: FeatureFlag, tier: Tier, override: boolean | null = null): boolean {
  if (override !== null) return override;
  return FEATURES[flag].defaultForTier(tier);
}

/** Reads the tenant-level override for a feature, if any. */
async function getFeatureOverride(orgId: string, flag: FeatureFlag): Promise<boolean | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organization_features")
    .select("enabled")
    .eq("organization_id", orgId)
    .eq("flag", flag)
    .maybeSingle();
  return data ? (data as { enabled: boolean }).enabled : null;
}

/** Returns the effective value of a single feature for an organization. */
export async function getFeatureFlag(orgId: string, flag: FeatureFlag): Promise<boolean> {
  const [org, override] = await Promise.all([getOrganization(orgId), getFeatureOverride(orgId, flag)]);
  if (!org) return false;
  return isFeatureEnabled(flag, orgPlanToTier(org.plan), override);
}

export interface FeatureFlagStatus {
  flag: FeatureFlag;
  name: string;
  description: string;
  enabled: boolean;
  source: "plan" | "override";
}

/** Lists all features with their effective values for an organization. */
export async function listFeatureFlags(orgId: string): Promise<FeatureFlagStatus[]> {
  const org = await getOrganization(orgId);
  if (!org) return [];

  const supabase = await createClient();
  const { data } = await supabase.from("organization_features").select("flag, enabled").eq("organization_id", orgId);

  const overrides = new Map<FeatureFlag, boolean>(
    (data ?? []).map((row) => [row.flag as FeatureFlag, (row as { enabled: boolean }).enabled])
  );

  const tier = orgPlanToTier(org.plan);
  return FEATURE_FLAG_KEYS.map((flag) => {
    const override = overrides.get(flag) ?? null;
    return {
      flag,
      name: FEATURES[flag].name,
      description: FEATURES[flag].description,
      enabled: isFeatureEnabled(flag, tier, override),
      source: override !== null ? "override" : "plan",
    };
  });
}

/** Sets or clears a tenant-level override. The DB policy enforces admin rights. */
export async function setFeatureFlag(
  orgId: string,
  flag: FeatureFlag,
  enabled: boolean,
  reason = ""
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("organization_features").upsert(
    {
      organization_id: orgId,
      flag,
      enabled,
      reason: reason || null,
      updated_at: new Date().toISOString(),
      updated_by: user?.id ?? null,
    },
    { onConflict: "organization_id, flag" }
  );

  if (error) return { ok: false, error: "Could not update the feature flag." };
  return { ok: true };
}
