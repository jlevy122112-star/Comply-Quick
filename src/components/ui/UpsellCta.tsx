import Link from "next/link";
import { ALL_TIERS, getTierConfig, type Tier } from "@/lib/pricing";
import { Badge } from "./Badge";
import { Card, CardBody } from "./Card";

/** Default upgrade pitch for the tier a user would move up to. */
const NEXT_TIER_PITCH: Record<Exclude<Tier, "free">, string> = {
  solo: "Unlimited generations, 20 scans/mo, and full contract shields.",
  agency: "Ongoing monitoring, 5 seats, white-label exports and 100 scans/mo.",
  enterprise: "Unlimited seats and scans, live regulatory monitoring, and audit-ready evidence.",
};

function formatUsd(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** The next tier up from `tier`, or null if already on the top tier. */
export function nextTierUp(tier: Tier): Exclude<Tier, "free"> | null {
  const idx = ALL_TIERS.indexOf(tier);
  const next = ALL_TIERS[idx + 1];
  return next && next !== "free" ? next : null;
}

export interface UpsellCtaProps {
  /** The viewer's current tier. Renders nothing on the top tier. */
  tier: Tier;
  /** Optional headline override (defaults to "Unlock more with <next tier>"). */
  title?: string;
  /** Optional benefit copy override (defaults to a per-tier pitch). */
  benefit?: string;
  className?: string;
}

/**
 * Tier-aware upgrade card. Computes the next tier up and surfaces a single,
 * consistent upsell CTA — used across screens so monetization stays at the
 * forefront without each screen re-implementing the pattern. Renders nothing
 * for enterprise (nothing to upsell).
 */
export function UpsellCta({ tier, title, benefit, className }: UpsellCtaProps) {
  const next = nextTierUp(tier);
  if (!next) return null;

  const cfg = getTierConfig(next);
  return (
    <Card className={className}>
      <CardBody className="space-y-2">
        <Badge tone="amber">Upgrade</Badge>
        <p className="text-sm font-semibold text-white">{title ?? `Unlock more with ${cfg.label}`}</p>
        <p className="text-xs text-gray-400">{benefit ?? NEXT_TIER_PITCH[next]}</p>
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
