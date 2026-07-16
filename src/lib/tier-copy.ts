import { ALL_TIERS, getTierConfig, isUnlimited, PAID_TIERS, type Tier } from "@/lib/pricing";

export type UpgradeTier = Exclude<Tier, "free">;
export type TierUpgradeFeature = "agencyPortal" | "enterpriseAlerts" | "unlimitedScans";

export function tierLabel(tier: Tier): string {
  return getTierConfig(tier).label;
}

export function scanAllowance(tier: Tier): string {
  const limit = getTierConfig(tier).scanLimit;
  return isUnlimited(limit) ? "Unlimited compliance scans" : `${limit} compliance scans / month`;
}

export function scanAllowanceShort(tier: Tier): string {
  const limit = getTierConfig(tier).scanLimit;
  return isUnlimited(limit) ? "Unlimited scans" : `${limit} scans/month`;
}

export function paidPlansLabel(): string {
  const labels = PAID_TIERS.map((tier) => tierLabel(tier));
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}` : (labels[0] ?? "");
}

export function nextTierUp(tier: Tier): UpgradeTier | null {
  const next = ALL_TIERS[ALL_TIERS.indexOf(tier) + 1];
  return next && next !== "free" ? next : null;
}

export function upgradeTargetFor(tier: Tier, feature?: TierUpgradeFeature): UpgradeTier | null {
  if (feature === "agencyPortal" && tier !== "enterprise" && tier !== "agency") return "agency";
  if (feature === "enterpriseAlerts" && tier !== "enterprise") return "enterprise";
  if (feature === "unlimitedScans" && !isUnlimited(getTierConfig(tier).scanLimit)) return "agency";
  return nextTierUp(tier);
}

export function tierUpgradeBenefit(tier: UpgradeTier): string {
  const config = getTierConfig(tier);
  const seats = isUnlimited(config.seats) ? "unlimited team seats" : `${config.seats} team seats`;

  if (tier === "enterprise") {
    return `${scanAllowanceShort(tier)}, ${seats}, live regulatory monitoring, and audit-ready evidence.`;
  }
  if (tier === "agency") {
    return `${scanAllowanceShort(tier)}, ${seats}, white-label exports, and client portal access.`;
  }
  return `${scanAllowanceShort(tier)}, full document packages, and compliance API access.`;
}
