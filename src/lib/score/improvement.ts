// Compliance score improvement path (Phase 4 / [Up4]).
//
// Pure, side-effect-free: turns a scan's findings into an ordered remediation
// plan, quantifying how many points each fix reclaims and the score the user
// would reach after applying it. Mirrors the analyzer's scoring model so the
// projected numbers match what a re-scan would actually produce.

import { SEVERITY_PENALTY, type Finding, type Severity } from "@/lib/scanner/analyzer";

export interface ImprovementStep {
  findingId: string;
  title: string;
  severity: Severity;
  recommendation: string;
  /** Points reclaimed by resolving this finding. */
  scoreGain: number;
  /** Projected score once this and all higher-priority steps are applied. */
  projectedScore: number;
}

export interface ImprovementPath {
  currentScore: number;
  /** Score reachable by clearing every actionable finding (capped at 100). */
  potentialScore: number;
  steps: ImprovementStep[];
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** Points a fix reclaims. Info findings are advisory (no scoring penalty). */
function gainFor(severity: Severity): number {
  return severity === "info" ? 0 : SEVERITY_PENALTY[severity];
}

/**
 * Builds the ordered improvement path for a scan. Highest-impact fixes
 * (critical, then warning) come first, each annotated with the running
 * projected score. Findings with no score impact are excluded.
 */
export function computeImprovementPath(currentScore: number, findings: Finding[]): ImprovementPath {
  const actionable = findings
    .filter((f) => gainFor(f.severity) > 0)
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  let running = currentScore;
  const steps: ImprovementStep[] = actionable.map((f) => {
    const scoreGain = gainFor(f.severity);
    running = Math.min(100, running + scoreGain);
    return {
      findingId: f.id,
      title: f.title,
      severity: f.severity,
      recommendation: f.recommendation,
      scoreGain,
      projectedScore: running,
    };
  });

  return { currentScore, potentialScore: running, steps };
}
