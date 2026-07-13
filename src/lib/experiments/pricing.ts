import { isProfitOptimizationEnabled } from "@/lib/optimizations/flags";

export type PricingExperimentVariant = "control" | "annual_default" | "agency_first" | "holdout";
export type BillingCycle = "monthly" | "annual";

export const PRICING_EXPERIMENT_COOKIE = "cq_exp_pricing_v1";
export const EXPERIMENT_ID_COOKIE = "cq_exp_uid";
const STORAGE_KEY = "cq_exp_pricing_v1";

const VARIANTS: PricingExperimentVariant[] = ["control", "annual_default", "agency_first", "holdout"];
const SERVER_ASSIGNED: PricingExperimentVariant[] = ["control", "annual_default", "agency_first"];
const WEIGHTS: Record<PricingExperimentVariant, number> = {
  control: 0.34,
  annual_default: 0.33,
  agency_first: 0.33,
  holdout: 0,
};

function normalizeVariant(value: string | null | undefined): PricingExperimentVariant | null {
  if (!value) return null;
  return VARIANTS.includes(value as PricingExperimentVariant) ? (value as PricingExperimentVariant) : null;
}

function forcedVariant(): PricingExperimentVariant | null {
  const forced = normalizeVariant(process.env.NEXT_PUBLIC_EXPERIMENT_PRICING_V1_FORCE);
  return forced;
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function weightedPick(seed: string): PricingExperimentVariant {
  const roll = hashSeed(seed);
  let cumulative = 0;
  for (const variant of SERVER_ASSIGNED) {
    cumulative += WEIGHTS[variant];
    if (roll <= cumulative) return variant;
  }
  return "control";
}

function randomStableId(): string {
  const partA = Math.random().toString(36).slice(2, 12);
  const partB = Date.now().toString(36);
  return `${partA}${partB}`;
}

export function readPricingVariantFromCookies(
  cookieHeader: string | null | undefined
): PricingExperimentVariant | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)cq_exp_pricing_v1=([^;]+)/);
  return normalizeVariant(match ? decodeURIComponent(match[1]) : null);
}

export function resolveServerPricingVariant(experimentId: string | null | undefined): {
  variant: PricingExperimentVariant;
  id: string;
  forced: boolean;
} {
  const forced = forcedVariant();
  const id = experimentId && experimentId.trim() ? experimentId : randomStableId();
  if (!isProfitOptimizationEnabled()) return { variant: "control", id, forced: false };
  if (forced) return { variant: forced, id, forced: true };
  return { variant: weightedPick(id), id, forced: false };
}

/**
 * Reads pricing experiment assignment in the browser.
 *
 * Priority order:
 * 1. forced env override
 * 2. server-assigned cookie
 * 3. previously persisted localStorage
 * 4. control fallback
 */
export function resolvePricingExperimentVariant(): PricingExperimentVariant {
  const forced = forcedVariant();
  if (forced) return forced;
  if (!isProfitOptimizationEnabled()) return "control";
  if (typeof document !== "undefined") {
    const cookieVariant = readPricingVariantFromCookies(document.cookie);
    if (cookieVariant) {
      try {
        window.localStorage.setItem(STORAGE_KEY, cookieVariant);
      } catch {
        // Ignore storage failures and continue with cookie assignment.
      }
      return cookieVariant;
    }
  }
  if (typeof window !== "undefined") {
    try {
      const stored = normalizeVariant(window.localStorage.getItem(STORAGE_KEY));
      if (stored) return stored;
    } catch {
      // Ignore storage failures and keep control default.
    }
  }
  return "control";
}

export function defaultBillingForVariant(variant: PricingExperimentVariant, fallback: BillingCycle): BillingCycle {
  if (variant === "annual_default") return "annual";
  return fallback;
}

export function orderedPlansForVariant<T extends string>(variant: PricingExperimentVariant, plans: readonly T[]): T[];
export function orderedPlansForVariant<T extends { key: string }>(
  variant: PricingExperimentVariant,
  plans: readonly T[]
): T[];
export function orderedPlansForVariant<T extends string | { key: string }>(
  variant: PricingExperimentVariant,
  plans: readonly T[]
): T[] {
  if (variant !== "agency_first") return [...plans];
  const isAgency = (p: T): boolean => (typeof p === "string" ? p === "agency" : p.key === "agency");
  const agency = plans.filter((p) => isAgency(p));
  const remainder = plans.filter((p) => !isAgency(p));
  return [...agency, ...remainder];
}
