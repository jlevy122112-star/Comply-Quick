// Freemium funnel — paywall trigger engine (Phase 5 / [Up5]).
//
// Pure, dependency-free logic that decides which contextual paywall messages to
// surface to a free user based on their latest scan / generated package. Kept
// side-effect-free so it is fully unit-testable and can run on client or server.
//
// Triggers (per the profitability spec): low score, score drop, missing clauses,
// missing ADA compliance, missing HIPAA compliance.

export type PaywallTriggerId = "low_score" | "score_drop" | "missing_clauses" | "missing_ada" | "missing_hipaa";

export type TriggerSeverity = "info" | "warning" | "critical";

export interface PaywallTrigger {
  id: PaywallTriggerId;
  severity: TriggerSeverity;
  /** Short, benefit-oriented headline shown on the paywall. */
  headline: string;
  /** One-line supporting detail. */
  detail: string;
}

export interface PaywallTriggerInput {
  /** Latest compliance score (0–100). */
  score?: number | null;
  /** The prior score for the same site, when available (for drop detection). */
  previousScore?: number | null;
  /** Count of unresolved critical/warning findings ("missing clauses"). */
  unresolvedFindings?: number;
  /** Whether ADA/WCAG accessibility coverage is present. */
  hasAda?: boolean;
  /** Whether HIPAA coverage is present. */
  hasHipaa?: boolean;
}

/** Scores at or below this are considered failing and fire the low-score trigger. */
export const LOW_SCORE_THRESHOLD = 70;
/** A drop of at least this many points fires the score-drop trigger. */
export const SCORE_DROP_THRESHOLD = 10;

const SEVERITY_RANK: Record<TriggerSeverity, number> = { critical: 0, warning: 1, info: 2 };

/**
 * Computes the ordered list of paywall triggers for a free user. Highest-severity
 * triggers come first. Returns an empty array when nothing warrants an upsell.
 */
export function computePaywallTriggers(input: PaywallTriggerInput): PaywallTrigger[] {
  const triggers: PaywallTrigger[] = [];
  const { score, previousScore, unresolvedFindings = 0, hasAda, hasHipaa } = input;

  if (typeof score === "number" && score < LOW_SCORE_THRESHOLD) {
    triggers.push({
      id: "low_score",
      severity: "critical",
      headline: `Your compliance score is ${score}/100`,
      detail: "Upgrade to unlock the full report and the fixes that raise your score.",
    });
  }

  if (typeof score === "number" && typeof previousScore === "number" && previousScore - score >= SCORE_DROP_THRESHOLD) {
    triggers.push({
      id: "score_drop",
      severity: "warning",
      headline: `Your score dropped ${previousScore - score} points`,
      detail: "See what changed and get one-click remediations with a paid plan.",
    });
  }

  if (unresolvedFindings > 0) {
    triggers.push({
      id: "missing_clauses",
      severity: "warning",
      headline: `${unresolvedFindings} compliance ${unresolvedFindings === 1 ? "gap" : "gaps"} detected`,
      detail: "Unlock the clauses and disclosures that close these gaps.",
    });
  }

  if (hasAda === false) {
    triggers.push({
      id: "missing_ada",
      severity: "info",
      headline: "No ADA / WCAG accessibility coverage",
      detail: "Add an ADA compliance pack to reduce accessibility lawsuit exposure.",
    });
  }

  if (hasHipaa === false) {
    triggers.push({
      id: "missing_hipaa",
      severity: "info",
      headline: "No HIPAA coverage",
      detail: "Add a HIPAA pack if you handle any protected health information.",
    });
  }

  return triggers.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}
