// ROI / value model.
//
// Quantifies the money a subscriber saves by generating compliance artifacts in
// Comply-Quick instead of commissioning them from an attorney. Every artifact
// type has a conservative attorney-equivalent cost (low–high range, US market
// rates for privacy/compliance counsel). The dashboard surfaces the running
// total ("You've saved $X"), and tool outputs show a per-artifact value line.
//
// Values are intentionally conservative and cited as ranges so the headline
// number is defensible rather than inflated.

export type ArtifactKind =
  "compliance_package" | "privacy_policy" | "dpa" | "cookie_banner" | "subprocessor_map" | "scan";

export interface ArtifactValue {
  label: string;
  /** Conservative attorney-equivalent cost used for the headline figure. */
  attorneyCost: number;
  /** Low–high market range shown as supporting context. */
  range: [number, number];
  /** One-line justification of the saving. */
  basis: string;
}

/**
 * Attorney-equivalent cost per generated artifact. `attorneyCost` is the
 * conservative (low-end) figure used for headline savings so the number never
 * overstates value.
 */
export const ARTIFACT_VALUES: Record<ArtifactKind, ArtifactValue> = {
  compliance_package: {
    label: "Compliance package",
    attorneyCost: 1500,
    range: [1500, 5000],
    basis: "Custom liability waiver + privacy policy + checklist drafted by counsel.",
  },
  privacy_policy: {
    label: "Privacy policy",
    attorneyCost: 750,
    range: [750, 2500],
    basis: "Bespoke, stack-specific privacy policy with per-pixel disclosures.",
  },
  dpa: {
    label: "Data Processing Agreement",
    attorneyCost: 900,
    range: [900, 3500],
    basis: "Controller–processor DPA with SCCs and a subprocessor annex.",
  },
  cookie_banner: {
    label: "Cookie consent banner",
    attorneyCost: 400,
    range: [400, 1500],
    basis: "Jurisdiction-aware consent UX + implementation guidance.",
  },
  subprocessor_map: {
    label: "Subprocessor register",
    attorneyCost: 500,
    range: [500, 2000],
    basis: "Art. 30 record of processing / vendor data-flow mapping.",
  },
  scan: {
    label: "Compliance scan",
    attorneyCost: 250,
    range: [250, 1000],
    basis: "Manual site compliance review of trackers and disclosures.",
  },
};

export interface UsageCounts {
  compliance_package?: number;
  privacy_policy?: number;
  dpa?: number;
  cookie_banner?: number;
  subprocessor_map?: number;
  scan?: number;
}

export interface RoiSummary {
  /** Gross attorney-equivalent value of everything generated. */
  grossSaved: number;
  /** Annualized subscription cost subtracted from gross. */
  subscriptionCost: number;
  /** grossSaved − subscriptionCost, floored at 0. */
  netSaved: number;
  /** Multiple of subscription cost returned as value (grossSaved / cost). */
  roiMultiple: number | null;
  /** Per-artifact breakdown for display. */
  lineItems: { kind: ArtifactKind; label: string; count: number; saved: number }[];
}

/** Attorney-equivalent value saved for a single artifact of the given kind. */
export function artifactSaving(kind: ArtifactKind): number {
  return ARTIFACT_VALUES[kind].attorneyCost;
}

/**
 * Computes the ROI summary from artifact usage counts and the subscriber's
 * annualized subscription cost. `subscriptionCost` should be the amount the
 * user actually pays over the period being summarized (0 for free tier).
 */
export function computeRoi(usage: UsageCounts, subscriptionCost = 0): RoiSummary {
  const kinds = Object.keys(ARTIFACT_VALUES) as ArtifactKind[];
  const lineItems = kinds
    .map((kind) => {
      const count = usage[kind] ?? 0;
      return { kind, label: ARTIFACT_VALUES[kind].label, count, saved: count * artifactSaving(kind) };
    })
    .filter((li) => li.count > 0);

  const grossSaved = lineItems.reduce((sum, li) => sum + li.saved, 0);
  const netSaved = Math.max(0, grossSaved - subscriptionCost);
  const roiMultiple = subscriptionCost > 0 ? Math.round((grossSaved / subscriptionCost) * 10) / 10 : null;

  return { grossSaved, subscriptionCost, netSaved, roiMultiple, lineItems };
}

/** Formats a whole-dollar USD amount, e.g. 1500 → "$1,500". */
export function formatUsd(amount: number): string {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}
