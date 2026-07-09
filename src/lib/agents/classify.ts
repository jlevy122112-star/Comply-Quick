// Pure relevance-classification helpers for the agents.
//
// Given a framework that changed, work out which customer industries and
// jurisdictions care — driven entirely by the INDUSTRY_PROFILE map so adding an
// industry or framework needs no change here.

import { INDUSTRY_PROFILE, FRAMEWORK_REGION_OVERRIDES, TARGET_INDUSTRIES, type TargetIndustry } from "./types";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import type { TargetRegion } from "@/components/ClauseEngine";

/** Industries for which the given framework is in-profile, most-relevant first. */
export function industriesForFramework(framework: RegulationFrameworkId): TargetIndustry[] {
  return TARGET_INDUSTRIES.filter((ind) => INDUSTRY_PROFILE[ind].frameworks.includes(framework)).sort(
    (a, b) => INDUSTRY_PROFILE[a].frameworks.indexOf(framework) - INDUSTRY_PROFILE[b].frameworks.indexOf(framework)
  );
}

/**
 * Distinct regions a framework's change should be routed to: the framework's
 * own jurisdiction (override) unioned with the regions of every industry it's
 * relevant to. The override ensures non-US/EU regimes (PIPEDA→Canada,
 * LGPD→Brazil, Australia Privacy Act→Australia) route to their home region.
 */
export function regionsForFramework(framework: RegulationFrameworkId): TargetRegion[] {
  const seen = new Set<TargetRegion>(FRAMEWORK_REGION_OVERRIDES[framework] ?? []);
  for (const ind of industriesForFramework(framework)) {
    for (const r of INDUSTRY_PROFILE[ind].regions) seen.add(r);
  }
  return [...seen];
}

/** All frameworks relevant to a given industry. */
export function frameworksForIndustry(industry: TargetIndustry): RegulationFrameworkId[] {
  return [...INDUSTRY_PROFILE[industry].frameworks];
}
