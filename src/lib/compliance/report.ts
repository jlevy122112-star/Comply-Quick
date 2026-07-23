// Accuracy-engine orchestration (phases 1-2 tie-together).
//
// Composes deterministic detection → context-graph traversal into a single,
// auditable report: what we detected (with confidence + provenance) and what
// the law therefore requires (obligations with traceable paths). Pure: no
// network/DB/AI, so it is fully unit-testable.

import { detectToolsDetailed, type DetectedToolDetail } from "@/lib/scanner/analyzer";
import { deriveObligations, type ObligationResult } from "./traverse";
import { getService } from "./catalog";
import type { DataCategory, JurisdictionId } from "./graph";

export interface ObligationReport {
  detected: DetectedToolDetail[];
  obligations: ObligationResult[];
  /** Distinct data categories implied by the detected services + declared extras. */
  dataCategories: DataCategory[];
  /** Mean detection confidence across detected services (0 when none detected). */
  detectionConfidence: number;
}

export interface ReportInput {
  html: string;
  requestUrls?: string[];
  jurisdictions: JurisdictionId[];
  dataCategories?: DataCategory[];
}

/** Builds the deterministic detection→obligations report for a scanned page. */
export function buildObligationReport(input: ReportInput): ObligationReport {
  const detected = detectToolsDetailed(input.html, input.requestUrls ?? []);

  // Only CONFIDENT detections drive legal obligations. Weak-only detections
  // (matched purely by generic signals, e.g. a self-hosted `analytics.min.js`)
  // are low-confidence hints capped at WEAK_ONLY_CONFIDENCE_CAP; letting them
  // derive obligations would falsely impose, say, Segment's full obligation set
  // on any site with a generically-named analytics bundle. The full `detected`
  // array (including weak hints) is still returned for transparency.
  const confident = detected.filter((d) => !d.isWeakOnly);
  const services = confident.map((d) => d.id);
  const obligations = deriveObligations({
    services,
    jurisdictions: input.jurisdictions,
    dataCategories: input.dataCategories,
  });

  const detectionConfidence =
    confident.length === 0
      ? 0
      : Math.round((confident.reduce((sum, d) => sum + d.confidence, 0) / confident.length) * 100) / 100;

  return {
    detected,
    obligations,
    dataCategories: mergeDataCategories(services, input.dataCategories ?? []),
    detectionConfidence,
  };
}

function mergeDataCategories(services: string[], extra: DataCategory[]): DataCategory[] {
  const set = new Set<DataCategory>(extra);
  for (const id of services) {
    const entry = getService(id);
    if (entry) for (const c of entry.dataCategories) set.add(c);
  }
  return Array.from(set).sort();
}
