// Canonical regulatory-change feed.
//
// Single source of truth for the "Regulatory Alerts" surface and for anything
// else that needs to reference current compliance developments (the AI
// assistant, autopilot proposals, per-project attention flags). Alerts are keyed
// to the same `TargetRegion` union the ClauseEngine validates against, so the
// dashboard can show each subscriber only the alerts that touch the
// jurisdictions their projects actually target — no hardcoding per screen.
//
// Descriptions are informational summaries of publicly documented regulatory
// developments, each linked to its official source. They are not legal advice.

import type { TargetRegion } from "@/components/ClauseEngine";

export type AlertSeverity = "info" | "warning" | "critical";

export interface RegulatoryAlert {
  id: string;
  /** ISO date (YYYY-MM-DD) the development takes/took effect or was published. */
  date: string;
  title: string;
  /** Short, plain-language summary of what changed and who it affects. */
  description: string;
  severity: AlertSeverity;
  /** Governing law/framework short name, e.g. "GDPR", "CCPA/CPRA". */
  law: string;
  /** Jurisdictions this alert applies to. */
  affectedRegions: TargetRegion[];
  /** Official primary source for the development. */
  sourceUrl: string;
}

/**
 * Current regulatory developments, newest first. Extend this list as
 * regulations change — every consuming surface updates automatically.
 */
export const REGULATORY_ALERTS: RegulatoryAlert[] = [
  {
    id: "eu_ai_act_gpai",
    date: "2025-08-02",
    title: "EU AI Act — GPAI & transparency obligations live",
    description:
      "Transparency and general-purpose AI obligations under the EU AI Act now apply. Sites using AI-driven personalization or automated content must disclose AI use; high-risk obligations phase in through 2026-2027.",
    severity: "warning",
    law: "EU AI Act",
    affectedRegions: ["eu_gdpr"],
    sourceUrl: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
  },
  {
    id: "ccpa_admt_2026",
    date: "2026-01-01",
    title: "CCPA/CPRA — automated decision-making & risk-assessment rules",
    description:
      "The CPPA's finalized regulations add consumer opt-out rights for automated decision-making technology (ADMT), plus mandatory risk assessments and cybersecurity audits. Review analytics/ad tech that profiles California users.",
    severity: "warning",
    law: "CCPA/CPRA",
    affectedRegions: ["california_ccpa"],
    sourceUrl: "https://cppa.ca.gov/regulations/",
  },
  {
    id: "gdpr_consent_or_pay",
    date: "2025-06-15",
    title: "GDPR — cookie consent enforcement tightened",
    description:
      "EDPB guidance requires explicit, granular, per-purpose consent for non-essential cookies. Pre-checked boxes, cookie walls without a genuine alternative, and bundled consent are non-compliant.",
    severity: "critical",
    law: "GDPR / ePrivacy",
    affectedRegions: ["eu_gdpr"],
    sourceUrl: "https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines_en",
  },
  {
    id: "ca_delete_act_drop",
    date: "2026-01-01",
    title: "California DELETE Act — data-broker deletion mechanism",
    description:
      "California's DELETE Act introduces a one-stop deletion request mechanism (DROP) for data brokers. If you buy or sell consumer data, verify registration and deletion-handling obligations.",
    severity: "info",
    law: "California DELETE Act",
    affectedRegions: ["california_ccpa"],
    sourceUrl: "https://cppa.ca.gov/data_broker_registry/",
  },
  {
    id: "us_state_laws_2026",
    date: "2026-01-01",
    title: "New US state privacy laws in effect",
    description:
      "Additional US state comprehensive privacy laws take effect in 2025-2026, extending opt-out, sensitive-data, and universal opt-out signal (GPC) requirements to more consumers. Honor Global Privacy Control site-wide.",
    severity: "info",
    law: "US State Privacy Laws",
    affectedRegions: ["us_general"],
    sourceUrl: "https://iapp.org/resources/article/us-state-privacy-legislation-tracker/",
  },
  {
    id: "brazil_lgpd_breach",
    date: "2025-04-01",
    title: "Brazil LGPD — breach notification regulation",
    description:
      "ANPD's breach-notification regulation sets fixed timelines and required content for reporting security incidents affecting Brazilian data subjects. Confirm your incident-response process meets the deadline.",
    severity: "info",
    law: "LGPD",
    affectedRegions: ["brazil_lgpd"],
    sourceUrl: "https://www.gov.br/anpd/pt-br",
  },
  {
    id: "canada_quebec_law25",
    date: "2024-09-22",
    title: "Quebec Law 25 — final phase in force",
    description:
      "Quebec's Law 25 is fully in force, including data portability and stricter consent for Canadian users. Federal reform (CPPA) remains pending — track for downstream PIPEDA changes.",
    severity: "info",
    law: "PIPEDA / Quebec Law 25",
    affectedRegions: ["canada_pipeda"],
    sourceUrl: "https://www.cai.gouv.qc.ca/",
  },
  {
    id: "australia_privacy_reform",
    date: "2024-12-10",
    title: "Australia Privacy Act — first reform tranche",
    description:
      "The first tranche of Privacy Act reforms introduces a statutory tort for serious privacy invasions and stronger enforcement powers for the OAIC. Broader consent and transparency changes are expected next.",
    severity: "info",
    law: "Australian Privacy Act",
    affectedRegions: ["australia_privacy"],
    sourceUrl: "https://www.oaic.gov.au/privacy/privacy-legislation/privacy-act-review",
  },
];

/**
 * Returns the alerts relevant to a set of target regions, newest first. With no
 * regions (e.g. a brand-new account) it returns the full feed so the user still
 * sees the compliance landscape.
 */
export function alertsForRegions(regions: TargetRegion[]): RegulatoryAlert[] {
  const relevant =
    regions.length === 0
      ? REGULATORY_ALERTS
      : REGULATORY_ALERTS.filter((a) => a.affectedRegions.some((r) => regions.includes(r)));
  return [...relevant].sort((a, b) => b.date.localeCompare(a.date));
}

/** Distinct target regions across a set of projects (order-stable). */
export function regionsFromProjects(projects: { targetRegions: TargetRegion[] }[]): TargetRegion[] {
  const seen = new Set<TargetRegion>();
  for (const p of projects) for (const r of p.targetRegions) seen.add(r);
  return [...seen];
}
