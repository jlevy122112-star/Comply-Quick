// Autopilot Remediation Agent.
//
// Consumes the Regulation Monitor Agent's findings and OFFERS to bring each
// affected user's compliance ecosystem into line with the new/changed law. It
// never edits live documents: it drafts a compliance *edit plan* and routes it
// through the existing propose-only autopilot flow, so every change waits for
// explicit human approval (accept/reject) before it is applied.

import { runAutopilot, type RegulationUpdate } from "@/lib/autopilot/service";
import { getAiClient, type AiClient } from "@/services/ai";
import { INDUSTRY_LABELS } from "./types";
import type { AgentRunResult, RegulationChangeFinding } from "./types";

/** A single, human-readable step in the offered compliance edit plan. */
export interface EditPlanStep {
  framework: string;
  law: string;
  institution: string;
  action: string;
  affectedIndustries: string[];
  affectedRegions: string[];
  sourceUrl: string;
  requiresApproval: true;
}

/**
 * Pure: turns a change finding into a described edit-plan step. The `action`
 * describes what Autopilot will *propose* — regenerating the affected policy,
 * consent, and DPA artifacts against the updated regulation — pending approval.
 */
export function buildEditPlanStep(finding: RegulationChangeFinding): EditPlanStep {
  const isNew = finding.previousHash === null;
  const verb = isNew ? "Establish baseline compliance for" : "Update affected documents to reflect changes in";
  return {
    framework: finding.framework,
    law: finding.label,
    institution: finding.institution,
    action: `${verb} ${finding.label} (${finding.institution}). Regenerate impacted policies, consent, and DPA clauses for review.`,
    affectedIndustries: finding.affectedIndustries.map((i) => INDUSTRY_LABELS[i]),
    affectedRegions: finding.affectedRegions.map(String),
    sourceUrl: finding.officialUrl,
    requiresApproval: true,
  };
}

export function buildEditPlan(findings: RegulationChangeFinding[]): EditPlanStep[] {
  return findings.map(buildEditPlanStep);
}

/**
 * Maps findings to per-region autopilot updates (one per affected region).
 * De-duplicated by `framework:region`: if two findings target the same pair
 * (e.g. two hash changes for one framework in a single sweep), the most recent
 * one wins so downstream `runAutopilot` never creates redundant proposals.
 */
export function remediationUpdatesFromFindings(findings: RegulationChangeFinding[]): RegulationUpdate[] {
  const byId = new Map<string, RegulationUpdate>();
  for (const f of findings) {
    for (const region of f.affectedRegions) {
      const id = `${f.framework}:${region}`;
      byId.set(id, {
        id,
        name: f.label,
        region,
        // The change fingerprint doubles as the regeneration seed; the autopilot
        // pipeline diffs it against the project's last version.
        content: `${f.currentHash}:${f.detectedAt}`,
        changeNote: `${f.institution} updated ${f.label}. Detected ${f.detectedAt.slice(0, 10)}.`,
        sourceUrl: f.officialUrl,
      });
    }
  }
  return [...byId.values()];
}

export interface RemediationRunResult extends AgentRunResult {
  editPlan: EditPlanStep[];
  proposalsCreated: number;
}

/**
 * Runs remediation for a set of findings: builds the edit plan and creates
 * propose-only document versions + notifications for affected users via
 * `runAutopilot`. Nothing is applied automatically — users approve each proposal.
 */
export async function runAutopilotRemediation(
  findings: RegulationChangeFinding[],
  ai: AiClient = getAiClient()
): Promise<RemediationRunResult> {
  const startedAt = new Date().toISOString();
  const editPlan = buildEditPlan(findings);

  let proposalsCreated = 0;
  if (findings.length > 0) {
    const updates = remediationUpdatesFromFindings(findings);
    const result = await runAutopilot(updates, ai);
    proposalsCreated = result.proposalsCreated;
  }

  const finishedAt = new Date().toISOString();
  return {
    agent: "autopilot_remediation",
    status: findings.length > 0 ? "ok" : "no_changes",
    startedAt,
    finishedAt,
    summary:
      findings.length > 0
        ? `Offered a ${editPlan.length}-step compliance edit plan; created ${proposalsCreated} proposal(s) awaiting approval.`
        : "No regulatory changes to remediate.",
    findings,
    editPlan,
    proposalsCreated,
  };
}
