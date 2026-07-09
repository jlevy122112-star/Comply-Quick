// Control catalogs available to the app without a live ingestion run.
//
// The Audit & Evidence agent (and gap analysis) needs a RegulationControl[] for
// a framework. For proprietary frameworks (SOC 2, ISO 27001, PCI DSS) we hold a
// public, license-safe control index (ids + titles + our own summaries), which
// we map into the normalized RegulationControl shape here. Full-text public
// frameworks (HIPAA/GDPR/NIST/CCPA) are sourced live by the ingestion pipeline,
// so they are not part of this static catalog.

import { PROPRIETARY_CONTROL_INDEX } from "./proprietary-index";
import { REGULATION_SOURCE_LIST, type RegulationFrameworkId } from "./sources/registry";
import type { RegulationControl } from "./types";

function officialUrlFor(framework: RegulationFrameworkId): string {
  return REGULATION_SOURCE_LIST.find((s) => s.framework === framework)?.officialUrl ?? "";
}

/**
 * Returns the normalized controls we can serve statically for a framework.
 * Currently the proprietary reference catalog; empty for full-text frameworks
 * that are only available via live ingestion.
 */
export function controlsForFramework(framework: RegulationFrameworkId): RegulationControl[] {
  const proprietary = PROPRIETARY_CONTROL_INDEX[framework];
  if (!proprietary) return [];
  const sourceUrl = officialUrlFor(framework);
  return proprietary.map((entry) => ({
    framework,
    id: entry.id,
    title: entry.title,
    description: entry.summary,
    requirements: [],
    evidenceExamples: [],
    riskLevel: entry.riskLevel,
    remediationSteps: [],
    sourceText: null,
    sourceUrl,
  }));
}

/** Frameworks that have a static control catalog (usable for evidence packs offline). */
export const FRAMEWORKS_WITH_STATIC_CONTROLS = Object.keys(PROPRIETARY_CONTROL_INDEX) as RegulationFrameworkId[];
