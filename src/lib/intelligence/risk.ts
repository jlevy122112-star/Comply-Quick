// Compliance Intelligence — risk detection (Phase 4).
//
// Pure, dependency-free comparison of a monitor's previous scan against its
// latest scan. Emits a list of risk events (the raw material for alerts) when a
// monitored site changes for the worse: a materially lower score, a newly
// detected tracker, or a new critical finding. No network/DB/AI here so it is
// fully unit-testable.

import type { DetectedTool, Finding, Severity } from "@/lib/scanner/analyzer";

/** Minimum score drop (points) between consecutive scans to raise an alert. */
export const SCORE_DROP_THRESHOLD = 5;

export type RiskType = "score_drop" | "new_tracker" | "new_critical" | "requirement_lost";

export interface RiskEvent {
  type: RiskType;
  severity: Severity;
  title: string;
  body: string;
  /** Structured context for the "Fix It" recommender + timeline. */
  detail: Record<string, unknown>;
}

export interface ScanSnapshot {
  score: number | null;
  detectedTools: DetectedTool[];
  findings: Finding[];
}

function toolKey(t: DetectedTool): string {
  return t.id;
}

const REQUIREMENT_FINDING_IDS = new Set(["missing_privacy_policy", "missing_terms", "trackers_without_consent"]);

/**
 * Compares two scans of the same URL and returns the risk events that the
 * transition introduces. `previous` is null on the very first scan of a monitor
 * (nothing to compare against, so no risk events are produced).
 */
export function detectRisks(previous: ScanSnapshot | null, current: ScanSnapshot): RiskEvent[] {
  if (!previous) return [];
  const events: RiskEvent[] = [];

  // 1. Score regression.
  if (typeof previous.score === "number" && typeof current.score === "number") {
    const drop = previous.score - current.score;
    if (drop >= SCORE_DROP_THRESHOLD) {
      events.push({
        type: "score_drop",
        severity: drop >= 15 ? "critical" : "warning",
        title: `Compliance score dropped ${drop} points`,
        body: `The compliance score fell from ${previous.score} to ${current.score} since the last check.`,
        detail: { previousScore: previous.score, currentScore: current.score, drop },
      });
    }
  }

  // 2. Newly detected trackers (present now, absent before).
  const prevTools = new Set(previous.detectedTools.map(toolKey));
  const newTools = current.detectedTools.filter((t) => !prevTools.has(toolKey(t)));
  if (newTools.length > 0) {
    const names = newTools.map((t) => t.name);
    events.push({
      type: "new_tracker",
      severity: "warning",
      title: `${newTools.length} new tracker${newTools.length > 1 ? "s" : ""} detected`,
      body: `New third-party tool${newTools.length > 1 ? "s" : ""} now loading: ${names.join(", ")}. Confirm each is disclosed and consent-gated.`,
      detail: { newTools: newTools.map((t) => ({ id: t.id, name: t.name, category: t.category })) },
    });
  }

  // 3. A requirement present in the prior scan is now missing.
  const previousFindingIds = new Set(previous.findings.map((finding) => finding.id));
  const lostRequirements = current.findings.filter(
    (finding) => REQUIREMENT_FINDING_IDS.has(finding.id) && !previousFindingIds.has(finding.id)
  );
  if (lostRequirements.length > 0) {
    events.push({
      type: "requirement_lost",
      severity: lostRequirements.some((finding) => finding.severity === "critical") ? "critical" : "warning",
      title:
        lostRequirements.length +
        " compliance requirement" +
        (lostRequirements.length > 1 ? "s" : "") +
        " no longer detected",
      body: lostRequirements.map((finding) => finding.title).join("; "),
      detail: {
        requirements: lostRequirements.map((finding) => ({
          id: finding.id,
          title: finding.title,
          detail: finding.detail,
          recommendation: finding.recommendation,
        })),
      },
    });
  }

  // 4. Other new critical findings (by finding id, present now, absent before).
  const prevCritical = new Set(previous.findings.filter((f) => f.severity === "critical").map((f) => f.id));
  const newCritical = current.findings.filter(
    (finding) =>
      finding.severity === "critical" && !prevCritical.has(finding.id) && !REQUIREMENT_FINDING_IDS.has(finding.id)
  );
  if (newCritical.length > 0) {
    events.push({
      type: "new_critical",
      severity: "critical",
      title: `${newCritical.length} new critical issue${newCritical.length > 1 ? "s" : ""}`,
      body: newCritical.map((f) => f.title).join("; "),
      detail: {
        findings: newCritical.map((f) => ({
          id: f.id,
          title: f.title,
          detail: f.detail,
          recommendation: f.recommendation,
        })),
      },
    });
  }

  return events;
}
