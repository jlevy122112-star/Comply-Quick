// Audit & Evidence Agent.
//
// Compiles a framework-specific audit trail / evidence pack so a subscriber can
// respond to an auditor on demand. It reads the normalized controls for a
// framework (from the ingestion pipeline's output) and, for each control, lists
// the evidence the org should attach and its current status. Pure assembly over
// provided controls so it's deterministic and testable.

import type { RegulationControl } from "@/lib/regulations/types";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import { action, orderPlan, type AgentActionPlan } from "./actions";

export type EvidenceStatus = "collected" | "missing" | "not_applicable";

export interface EvidenceItem {
  controlId: string;
  controlTitle: string;
  riskLevel: RegulationControl["riskLevel"];
  /** What the org should attach to satisfy this control. */
  requiredEvidence: string[];
  status: EvidenceStatus;
  sourceUrl: string;
}

export interface AuditEvidencePack {
  framework: RegulationFrameworkId;
  generatedAt: string;
  totalControls: number;
  collected: number;
  missing: number;
  /** 0–100 readiness = collected / applicable. */
  readiness: number;
  items: EvidenceItem[];
  plan: AgentActionPlan;
}

/** Map of controlId → whether the org has already collected its evidence. */
export type EvidenceLedger = Record<string, boolean>;

function requiredEvidenceFor(control: RegulationControl): string[] {
  if (control.evidenceExamples.length > 0) return control.evidenceExamples.slice(0, 3);
  // Fall back to a generic, framework-agnostic evidence set keyed on risk.
  const base = ["Written policy referencing this control", "Record of last review/approval"];
  if (control.riskLevel === "high") base.push("Operating evidence (logs, tickets, or config export)");
  return base;
}

/**
 * Builds a framework-specific evidence pack. `ledger` marks controls whose
 * evidence is already collected; everything else is flagged missing so the
 * auditor prep surfaces exactly what's outstanding.
 */
export function compileEvidencePack(
  framework: RegulationFrameworkId,
  controls: RegulationControl[],
  ledger: EvidenceLedger = {},
  now: Date = new Date()
): AuditEvidencePack {
  const items: EvidenceItem[] = controls.map((c) => ({
    controlId: c.id,
    controlTitle: c.title,
    riskLevel: c.riskLevel,
    requiredEvidence: requiredEvidenceFor(c),
    status: ledger[c.id] ? "collected" : "missing",
    sourceUrl: c.sourceUrl,
  }));

  const applicable = items.filter((i) => i.status !== "not_applicable");
  const collected = applicable.filter((i) => i.status === "collected").length;
  const missing = applicable.length - collected;
  const readiness = applicable.length === 0 ? 100 : Math.round((collected / applicable.length) * 100);

  // Offer to compile the pack; prioritize by how much evidence is missing.
  const actions = [
    action(
      "compile_evidence",
      `Compile the ${framework.toUpperCase()} evidence pack (${collected}/${applicable.length} controls ready).`,
      { framework, missing },
      missing > 0 ? 30 : 10
    ),
  ];

  return {
    framework,
    generatedAt: now.toISOString(),
    totalControls: controls.length,
    collected,
    missing,
    readiness,
    items,
    plan: orderPlan({
      agent: "audit_evidence",
      title: `${framework.toUpperCase()} audit evidence pack`,
      rationale:
        missing > 0
          ? `${missing} control(s) are missing evidence. Compile the pack to see exactly what an auditor will ask for.`
          : "All applicable controls have evidence. The pack is audit-ready.",
      actions,
    }),
  };
}
