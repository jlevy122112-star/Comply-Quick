import type { Tier } from "@/lib/pricing";
import { FEATURE_GATE_MATRIX } from "@/lib/growth/phase1-contract";

const TIER_ORDER: Tier[] = ["free", "solo", "agency", "enterprise"];

export type FeatureGateKey = keyof typeof FEATURE_GATE_MATRIX;

function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

export function canAccessFeature(tier: Tier, feature: FeatureGateKey): boolean {
  return tierRank(tier) >= tierRank(FEATURE_GATE_MATRIX[feature].minimumTier);
}
