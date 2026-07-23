// Rule-based compliance linter (accuracy engine — phase 4, foundation).
//
// Catches shallow coverage and contradictions BEFORE a user ever sees the docs.
// Given what was detected on the site + what the documents actually cover, it
// applies deterministic rules ("processor present but no DPA → error") and
// returns structured findings. Pure and dependency-free; no LLM involved, so a
// lint error is always explainable and reproducible.

import type { JurisdictionId } from "./graph";
import { getService } from "./catalog";

export type LintSeverity = "error" | "warning";

export interface LintFinding {
  id: string;
  severity: LintSeverity;
  message: string;
  /** Obligation node id this finding maps to, when applicable. */
  obligationId?: string;
  /** Service ids implicated by the finding. */
  serviceIds?: string[];
}

/** What the site's / generated documents actually cover — the linter's second input. */
export interface ComplianceState {
  /** Detected service ids (scanner fingerprint ids). */
  services: string[];
  jurisdictions: JurisdictionId[];
  hasPrivacyPolicy: boolean;
  /** A consent management platform that blocks non-essential scripts pre-consent. */
  hasConsentMechanism: boolean;
  /** Service ids for which a DPA is in place / covered. */
  dpaWith: string[];
  /** Service ids for which a joint-controller arrangement (Art. 26) is in place. */
  jointControllerArrangements?: string[];
  /** Whether Standard Contractual Clauses are addressed for international transfers. */
  mentionsSccs: boolean;
  /** Whether PCI-DSS scope (SAQ / data-flow) is addressed. */
  addressesPci: boolean;
  /** Whether recognized universal opt-out / GPC signals are honored. */
  honorsUniversalOptOut?: boolean;
}

function isEu(jurisdictions: JurisdictionId[]): boolean {
  return jurisdictions.includes("eu") || jurisdictions.includes("uk");
}

/**
 * Runs the compliance rules against the detected stack + document coverage.
 * Returns findings sorted errors-first, then by id.
 */
export function lintCompliance(state: ComplianceState): LintFinding[] {
  const findings: LintFinding[] = [];
  const entries = state.services.map((id) => getService(id)).filter((e) => e !== undefined);

  // Consent-gated behavioral trackers are flagged EXPLICITLY via `consentGated`,
  // not inferred from `dataCategories`. This decouples the consent decision from
  // the data shape so pure error monitoring (Sentry) — which touches
  // `online_activity`-shaped data but does no behavioral tracking — is not swept
  // in, matching the scanner's category-based exclusion of `error_monitoring`.
  const trackers = entries.filter((e) => e.consentGated);
  const processors = entries.filter((e) => e.role === "processor" || e.role === "sub_processor");
  const jointControllers = entries.filter((e) => e.role === "joint_controller");
  const payments = entries.filter((e) => e.dataCategories.includes("financial"));
  const dpaSet = new Set(state.dpaWith);
  const jcaSet = new Set(state.jointControllerArrangements ?? []);

  // Rule 1: any personal-data service but no privacy policy → error.
  if (entries.length > 0 && !state.hasPrivacyPolicy) {
    findings.push({
      id: "missing_privacy_policy",
      severity: "error",
      message: `Personal-data services detected (${entries.map((e) => e.name).join(", ")}) but no privacy policy is published.`,
      obligationId: "gdpr.art13.privacy_notice",
      serviceIds: entries.map((e) => e.id),
    });
  }

  // Rules 2 & 2b are GDPR Art. 28/26 obligations, which apply in the EU/UK only —
  // gate them on jurisdiction so the linter agrees with the traversal engine
  // (which scopes these obligations to EU/UK) instead of flagging a US-only site.
  const gdprApplies = isEu(state.jurisdictions);

  // Rule 2: processor present but no DPA covering it → error (per processor).
  for (const p of processors) {
    if (gdprApplies && !dpaSet.has(p.id)) {
      findings.push({
        id: `missing_dpa_${p.id}`,
        severity: "error",
        message: `${p.name} acts as a data processor but no Data Processing Agreement is recorded for it.`,
        obligationId: "gdpr.art28.dpa",
        serviceIds: [p.id],
      });
    }
  }

  // Rule 2b: joint controller present but no Art. 26 arrangement → error (per controller).
  for (const jc of jointControllers) {
    if (gdprApplies && !jcaSet.has(jc.id)) {
      findings.push({
        id: `missing_jca_${jc.id}`,
        severity: "error",
        message: `${jc.name} acts as a joint controller but no Art. 26 joint-controller arrangement is recorded for it.`,
        obligationId: "gdpr.art26.joint_controller",
        serviceIds: [jc.id],
      });
    }
  }

  // Rule 3: trackers detected but no consent mechanism → warning (error in EU/UK).
  if (trackers.length > 0 && !state.hasConsentMechanism) {
    findings.push({
      id: "trackers_without_consent",
      severity: isEu(state.jurisdictions) ? "error" : "warning",
      message: `${trackers.length} tracking service(s) load (${trackers.map((e) => e.name).join(", ")}) with no consent mechanism that blocks them pre-consent.`,
      obligationId: "gdpr.art7.consent",
      serviceIds: trackers.map((e) => e.id),
    });
  }

  // Colorado and Connecticut require controllers to honor recognized
  // universal opt-out mechanisms. This is only linted when the caller
  // explicitly records a negative result; a public scan cannot prove the
  // site's signal-handling behavior from HTML alone.
  if (
    trackers.length > 0 &&
    state.honorsUniversalOptOut === false &&
    (state.jurisdictions.includes("us_co") || state.jurisdictions.includes("us_ct"))
  ) {
    const universalOptOutStates = [
      {
        jurisdiction: "us_co",
        name: "Colorado",
        obligationId: "cpa.universal_opt_out",
      },
      {
        jurisdiction: "us_ct",
        name: "Connecticut",
        obligationId: "ctdpa.universal_opt_out",
      },
    ] as const;
    for (const stateLaw of universalOptOutStates) {
      if (!state.jurisdictions.includes(stateLaw.jurisdiction)) continue;
      findings.push({
        id: `universal_opt_out_not_honored_${stateLaw.jurisdiction}`,
        severity: "error",
        message: `${stateLaw.name} universal opt-out / GPC signals may not be honored based on the recorded site configuration.`,
        obligationId: stateLaw.obligationId,
        serviceIds: trackers.map((e) => e.id),
      });
    }
  }

  // Rule 4: EU/UK data + a non-EU vendor + SCCs not addressed → error.
  if (isEu(state.jurisdictions) && !state.mentionsSccs) {
    const nonEu = entries.filter((e) => e.vendorRegion !== "eu");
    if (nonEu.length > 0) {
      findings.push({
        id: "transfers_without_sccs",
        severity: "error",
        message: `EU/UK personal data is shared with non-EEA vendor(s) (${nonEu.map((e) => e.name).join(", ")}) but Standard Contractual Clauses / a transfer safeguard are not addressed.`,
        obligationId: "gdpr.art46.transfers",
        serviceIds: nonEu.map((e) => e.id),
      });
    }
  }

  // Rule 5: payment processing detected but PCI scope not addressed → warning.
  if (payments.length > 0 && !state.addressesPci) {
    findings.push({
      id: "pci_not_addressed",
      severity: "warning",
      message: `Payment service(s) detected (${payments.map((e) => e.name).join(", ")}) but PCI-DSS scope (SAQ / payment data-flow) is not addressed.`,
      obligationId: "pci_dss.saq_scope",
      serviceIds: payments.map((e) => e.id),
    });
  }

  findings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return findings;
}
