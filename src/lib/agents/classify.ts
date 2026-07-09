// Pure relevance-classification helpers for the agents.
//
// Given a framework that changed, work out which customer industries and
// jurisdictions care — driven entirely by the INDUSTRY_PROFILE map so adding an
// industry or framework needs no change here.

import { INDUSTRY_PROFILE, TARGET_INDUSTRIES, type TargetIndustry } from "./types";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import type { TargetRegion } from "@/components/ClauseEngine";

/** Industries for which the given framework is in-profile, most-relevant first. */
export function industriesForFramework(framework: RegulationFrameworkId): TargetIndustry[] {
  return TARGET_INDUSTRIES.filter((ind) => INDUSTRY_PROFILE[ind].frameworks.includes(framework)).sort(
    (a, b) => INDUSTRY_PROFILE[a].frameworks.indexOf(framework) - INDUSTRY_PROFILE[b].frameworks.indexOf(framework)
  );
}

/** Distinct regions across every industry that a framework is relevant to. */
export function regionsForFramework(framework: RegulationFrameworkId): TargetRegion[] {
  const seen = new Set<TargetRegion>();
  for (const ind of industriesForFramework(framework)) {
    for (const r of INDUSTRY_PROFILE[ind].regions) seen.add(r);
  }
  return [...seen];
}

/** All frameworks relevant to a given industry. */
export function frameworksForIndustry(industry: TargetIndustry): RegulationFrameworkId[] {
  return [...INDUSTRY_PROFILE[industry].frameworks];
}
