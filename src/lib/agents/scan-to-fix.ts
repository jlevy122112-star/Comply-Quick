// Scan-to-Fix Agent.
//
// After a compliance scan, turns each finding into a prioritized remediation
// action that one-click generates the exact artifact the finding needs (consent
// banner, DPA, privacy policy, subprocessor map). Pure planner — it emits a
// confirm-before-act `AgentActionPlan`; the executor runs approved actions
// against the existing tool/ClauseEngine services.

import type { Finding, Severity, ScanAnalysis } from "@/lib/scanner/analyzer";
import { action, orderPlan, type AgentActionPlan, type AgentActionType } from "./actions";

const SEVERITY_PRIORITY: Record<Severity, number> = { critical: 30, warning: 20, info: 10 };

/**
 * Maps a finding to the artifact that remediates it. Heuristic over the
 * finding's id/title/recommendation so new fingerprints route sensibly without
 * hardcoding per-finding branches.
 */
export function remediationForFinding(finding: Finding): AgentActionType | null {
  const hay = `${finding.id} ${finding.title} ${finding.recommendation}`.toLowerCase();
  // Ordered most-specific → most-generic so a narrow match (subprocessor, DPA)
  // wins before the broad `policy` catch. The final `privacy policy|policy`
  // branch is intentionally last so unrelated "policy" mentions only fall here
  // when nothing more specific matched.
  if (/consent|cookie|banner|cmp/.test(hay)) return "generate_cookie_banner";
  if (/subprocessor|data flow|data transfer|cross-border/.test(hay)) return "generate_subprocessor_map";
  if (/processor|dpa|vendor|third[- ]party/.test(hay)) return "generate_dpa";
  if (/privacy policy|privacy notice|disclosure|privacy|policy|notice/.test(hay)) return "generate_policy";
  // A finding with no direct artifact still deserves a documented review.
  return finding.severity === "info" ? null : "generate_policy";
}

export interface ScanToFixInput {
  analysis: ScanAnalysis;
  projectId?: string;
  url?: string;
}

/**
 * Produces a prioritized, one-click remediation plan from a scan. Critical
 * findings first; each actionable finding becomes an approval-gated action with
 * the params the target generator needs.
 */
export function planScanToFix(input: ScanToFixInput): AgentActionPlan {
  const { analysis } = input;
  const actions = analysis.findings
    .map((f) => {
      const type = remediationForFinding(f);
      if (!type) return null;
      return action(
        type,
        `${f.severity.toUpperCase()}: ${f.title} — ${f.recommendation}`,
        { findingId: f.id, projectId: input.projectId ?? "", severity: f.severity },
        SEVERITY_PRIORITY[f.severity]
      );
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  // Deduplicate by action type, keeping the highest-priority instance so the
  // user isn't asked to generate the same artifact twice.
  const byType = new Map<AgentActionType, (typeof actions)[number]>();
  for (const a of actions) {
    const existing = byType.get(a.type);
    if (!existing || a.priority > existing.priority) byType.set(a.type, a);
  }

  const critical = analysis.findings.filter((f) => f.severity === "critical").length;
  const rationale =
    byType.size === 0
      ? "No artifact-generating remediations were needed; the scan surfaced no actionable gaps."
      : `Scan surfaced ${analysis.findings.length} finding(s) (${critical} critical). ` +
        `Generating ${byType.size} artifact(s) will close the highest-impact gaps first.`;

  return orderPlan({
    agent: "scan_to_fix",
    title: "Scan-to-Fix remediation plan",
    rationale,
    actions: [...byType.values()],
  });
}
