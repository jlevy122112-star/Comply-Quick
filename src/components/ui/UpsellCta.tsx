import Link from "next/link";
import { getTierConfig, type Tier } from "@/lib/pricing";
import {
  nextTierUp,
  tierUpgradeBenefit,
  type TierUpgradeFeature,
  type UpgradeTier,
  upgradeTargetFor,
} from "@/lib/tier-copy";
import { formatUsd } from "@/lib/roi/value";
import { Badge } from "./Badge";
import { Card, CardBody } from "./Card";

export { nextTierUp };

export interface UpsellCtaProps {
  /** The viewer's current tier. Renders nothing on the top tier. */
  tier: Tier;
  /** Optional headline override (defaults to "Unlock more with <next tier>"). */
  title?: string;
  /** Optional benefit copy override (defaults to a per-tier pitch). */
  benefit?: string;
  /** Optional feature whose required tier may differ from the sequential upgrade. */
  feature?: TierUpgradeFeature;
  className?: string;
}

/**
 * Tier-aware upgrade card. Computes the next tier up and surfaces a single,
 * consistent upsell CTA — used across screens so monetization stays at the
 * forefront without each screen re-implementing the pattern. Renders nothing
 * for enterprise (nothing to upsell).
 */
export function UpsellCta({ tier, title, benefit, feature, className }: UpsellCtaProps) {
  const next: UpgradeTier | null = upgradeTargetFor(tier, feature);
  if (!next) return null;

  const cfg = getTierConfig(next);
  return (
    <Card className={className}>
      <CardBody className="space-y-2">
        <Badge tone="amber">Upgrade</Badge>
        <p className="text-sm font-semibold text-white">{title ?? `Unlock more with ${cfg.label}`}</p>
        <p className="text-xs text-gray-400">{benefit ?? tierUpgradeBenefit(next)}</p>
        <Link
          href="/#pricing"
          className="mt-1 block w-full rounded-lg bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400"
        >
          Upgrade to {cfg.label} — {formatUsd(cfg.monthly)}/mo
        </Link>
      </CardBody>
    </Card>
  );
}
