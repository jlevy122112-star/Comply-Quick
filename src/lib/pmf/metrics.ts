import { isEmailAllowed, parseEmailAllowlist } from "@/lib/access-policy";

// [Up11] PMF validation — pure, dependency-free metric helpers.
//
// Kept side-effect-free and DB-agnostic so they unit-test cleanly; the service
// layer fetches rows and feeds plain arrays into these functions.

export type NpsCategory = "promoter" | "passive" | "detractor";

/** Standard NPS bucketing: 9–10 promoter, 7–8 passive, 0–6 detractor. */
export function categorizeNps(score: number): NpsCategory {
  if (score >= 9) return "promoter";
  if (score >= 7) return "passive";
  return "detractor";
}

export interface NpsSummary {
  count: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** Net Promoter Score: %promoters − %detractors, rounded, range −100..100. */
  nps: number;
}

/** Computes NPS from raw 0–10 scores. Out-of-range scores are ignored. */
export function computeNps(scores: number[]): NpsSummary {
  const valid = scores.filter((s) => Number.isFinite(s) && s >= 0 && s <= 10);
  const count = valid.length;
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of valid) {
    const c = categorizeNps(s);
    if (c === "promoter") promoters++;
    else if (c === "passive") passives++;
    else detractors++;
  }
  const nps = count === 0 ? 0 : Math.round(((promoters - detractors) / count) * 100);
  return { count, promoters, passives, detractors, nps };
}

/** A rate in [0,1], rounded to 4 dp; 0 when the denominator is 0. */
export function rate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 10000;
}

/** Convenience alias — trial→paid / retention are both simple rates. */
export const conversionRate = rate;
export const retentionRate = rate;

/** Whole-percent form of a rate (e.g. 0.1234 → 12.3). */
export function toPercent(r: number): number {
  return Math.round(r * 1000) / 10;
}

/** Tallies a count per distinct key, e.g. churn reasons or acquisition channels. */
export function tallyBy<T>(items: T[], keyOf: (item: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

/** Canonical churn/cancellation reasons for the exit survey. */
export const CHURN_REASONS = [
  "too_expensive",
  "missing_features",
  "not_using",
  "switched_tool",
  "one_time_need",
  "other",
] as const;
export type ChurnReason = (typeof CHURN_REASONS)[number];

export const CHURN_REASON_LABELS: Record<ChurnReason, string> = {
  too_expensive: "Too expensive",
  missing_features: "Missing features I need",
  not_using: "Not using it enough",
  switched_tool: "Switched to another tool",
  one_time_need: "Only had a one-time need",
  other: "Other",
};

export function isChurnReason(value: unknown): value is ChurnReason {
  return typeof value === "string" && (CHURN_REASONS as readonly string[]).includes(value);
}

/** @deprecated Use parseEmailAllowlist from @/lib/access-policy. */
export const parseAdminEmails = parseEmailAllowlist;

export function isPmfAdmin(email: string | null | undefined, raw: string | undefined): boolean {
  return isEmailAllowed(email, raw);
}
