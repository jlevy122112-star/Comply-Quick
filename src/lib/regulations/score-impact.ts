// Regulatory score impact.
//
// When the Regulation Monitor Agent detects a real-world change that affects a
// user's project, an approval-gated remediation proposal is created and the
// project is flagged `action_needed`. Until the user signs in and approves the
// edit plan, their *displayed* compliance score should reflect the open
// regulatory exposure — this is what urges re-engagement. This module computes
// that adjustment deterministically and purely, so it's identical across the
// dashboard, badges, and API.

/** A pending, unapproved regulatory proposal weighing on a project's score. */
export interface PendingRegulatoryPressure {
  regulationId: string;
  law: string;
  /** Highest risk level among the changed controls, drives the penalty size. */
  riskLevel: "low" | "medium" | "high";
}

export const PENALTY_BY_RISK: Record<PendingRegulatoryPressure["riskLevel"], number> = {
  low: 4,
  medium: 8,
  high: 14,
};

/** Diminishing-returns cap so a flood of alerts can't zero out the score. */
const MAX_TOTAL_PENALTY = 35;

export interface RegulatoryScoreAdjustment {
  baseScore: number;
  adjustedScore: number;
  penalty: number;
  pendingCount: number;
  /** True when there is open regulatory exposure the user should act on. */
  actionNeeded: boolean;
}

/**
 * Applies a bounded penalty to a base compliance score for each pending
 * (unapproved) regulatory change. Penalties diminish so the score degrades
 * gracefully rather than collapsing. Never returns below 0 or above the base.
 */
export function applyRegulatoryImpact(
  baseScore: number,
  pending: PendingRegulatoryPressure[]
): RegulatoryScoreAdjustment {
  const clampedBase = Math.max(0, Math.min(100, Math.round(baseScore)));
  // Sort highest-penalty first, then apply diminishing weights (1, 0.6, 0.4, …).
  const weights = [1, 0.6, 0.4, 0.25, 0.15];
  const ordered = [...pending].sort((a, b) => PENALTY_BY_RISK[b.riskLevel] - PENALTY_BY_RISK[a.riskLevel]);

  let raw = 0;
  ordered.forEach((p, i) => {
    const weight = weights[i] ?? 0.1;
    raw += PENALTY_BY_RISK[p.riskLevel] * weight;
  });

  const penalty = Math.min(MAX_TOTAL_PENALTY, Math.round(raw));
  const adjustedScore = Math.max(0, clampedBase - penalty);

  return {
    baseScore: clampedBase,
    adjustedScore,
    penalty,
    pendingCount: pending.length,
    actionNeeded: pending.length > 0 && penalty > 0,
  };
}

/** Short, re-engagement-oriented summary for the dashboard / notification. */
export function regulatoryImpactMessage(adj: RegulatoryScoreAdjustment): string {
  if (!adj.actionNeeded) return "Your compliance is up to date with current regulations.";
  const laws = adj.pendingCount === 1 ? "a regulatory change" : `${adj.pendingCount} regulatory changes`;
  return `Your compliance score dropped ${adj.penalty} points due to ${laws}. Sign in to review and approve the fix.`;
}
