// OAuth Compliance Connector — remediation planner.
//
// Turns compliance lint findings into a concrete change set for a connected
// site, then decides — deterministically — whether each change may be applied
// automatically or must be proposed for human publish. Two hard rules override
// `auto` mode and always fall back to propose:
//   1. High-risk changes are never auto-applied.
//   2. Document/content changes (a published policy or disclosure page) ALWAYS
//      require human approval before publishing — auto-updating documentation is
//      never pushed live automatically. Only low-risk, non-document config
//      toggles are eligible for auto-apply.

import type { LintFinding } from "@/lib/compliance/linter";
import type { ConnectionMode, ConnectionStatus, RemediationChange } from "./types";
import { canAutoWrite } from "./state-machine";

/** Maps a lint finding id to the concrete site change that remedies it. */
const REMEDIATION_MAP: Record<string, Omit<RemediationChange, "obligationId">> = {
  missing_privacy_policy: {
    id: "publish_privacy_policy",
    summary: "Publish a generated privacy policy page and link it site-wide.",
    target: "page:privacy",
    risk: "medium",
  },
  trackers_without_consent: {
    id: "inject_consent_banner",
    summary: "Inject a consent banner that blocks non-essential trackers until opt-in.",
    target: "script_tag:consent",
    risk: "high",
  },
  transfers_without_sccs: {
    id: "add_transfer_disclosure",
    summary: "Add an international-transfer / SCC disclosure section to the privacy policy.",
    target: "page:privacy#transfers",
    risk: "medium",
  },
  pci_not_addressed: {
    id: "add_pci_notice",
    summary: "Add a payment-security notice describing PCI scope and the hosted checkout flow.",
    target: "page:privacy#payments",
    risk: "low",
  },
};

export interface PlannedRemediation {
  change: RemediationChange;
  /** Resolved disposition given the connection's mode/status and change risk. */
  disposition: "auto_apply" | "propose";
}

/**
 * Builds the plan from lint findings. DPA findings are intentionally excluded —
 * signing a processor DPA is an off-site legal action, not a site write, so it
 * is surfaced as a recommendation elsewhere, never as an automated change.
 */
export function planRemediations(
  findings: LintFinding[],
  ctx: { mode: ConnectionMode; status: ConnectionStatus }
): PlannedRemediation[] {
  const plan: PlannedRemediation[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    const mapped = REMEDIATION_MAP[f.id];
    if (!mapped) continue;
    if (seen.has(mapped.id)) continue;
    seen.add(mapped.id);
    const change: RemediationChange = { ...mapped, obligationId: f.obligationId };
    // A "page:" target publishes/edits a document, which always needs approval.
    const isDocumentChange = change.target.startsWith("page:");
    const auto = canAutoWrite(ctx.status, ctx.mode) && change.risk !== "high" && !isDocumentChange;
    plan.push({ change, disposition: auto ? "auto_apply" : "propose" });
  }
  return plan;
}
