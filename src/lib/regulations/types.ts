// Structured, normalized regulation model.
//
// Every framework the ingestion pipeline touches — regardless of its raw format
// (eCFR JSON, NIST OSCAL, EUR-Lex HTML, or a reference-only proprietary catalog)
// — is normalized into these shapes. Downstream (clause generation, risk
// scoring, gap analysis, audit prep, the monitoring agent) reads only these
// types, never the raw source, so adding or updating a source never ripples
// beyond the pipeline.

import type { RegulationFrameworkId, SourceLicense } from "./sources/registry";

export type RiskLevel = "low" | "medium" | "high";

/**
 * A single normalized control/requirement extracted from a regulation.
 * `sourceText` is only populated for public-domain / freely-reusable sources;
 * for proprietary frameworks it is null and only `id`/`title` are citable.
 */
export interface RegulationControl {
  framework: RegulationFrameworkId;
  /** Canonical control identifier, e.g. "CC1.1", "164.312(a)(1)", "AC-2". */
  id: string;
  title: string;
  /** Faithful summary of the control's intent (never a verbatim proprietary quote). */
  description: string;
  requirements: string[];
  evidenceExamples: string[];
  riskLevel: RiskLevel;
  remediationSteps: string[];
  /** Verbatim normative text — public-domain sources only; else null. */
  sourceText: string | null;
  /** Deep link to this control at the official source, when addressable. */
  sourceUrl: string;
}

/** A fully-normalized framework snapshot produced by one ingestion run. */
export interface NormalizedRegulation {
  framework: RegulationFrameworkId;
  label: string;
  institution: string;
  officialUrl: string;
  license: SourceLicense;
  /** ISO timestamp the pipeline fetched the source. */
  fetchedAt: string;
  /**
   * Version/edition string reported by the source when available (e.g. the
   * eCFR amendment date, the OSCAL catalog `last-modified`), else the fetch date.
   */
  sourceVersion: string;
  /** Stable content hash over the normalized controls, for change detection. */
  contentHash: string;
  controls: RegulationControl[];
}

/** Compact catalog entry describing an ingested framework (no control bodies). */
export interface RegulationCatalogEntry {
  framework: RegulationFrameworkId;
  label: string;
  institution: string;
  officialUrl: string;
  license: SourceLicense;
  fetchedAt: string;
  sourceVersion: string;
  contentHash: string;
  controlCount: number;
  ingestedFullText: boolean;
}

export function toCatalogEntry(reg: NormalizedRegulation): RegulationCatalogEntry {
  return {
    framework: reg.framework,
    label: reg.label,
    institution: reg.institution,
    officialUrl: reg.officialUrl,
    license: reg.license,
    fetchedAt: reg.fetchedAt,
    sourceVersion: reg.sourceVersion,
    contentHash: reg.contentHash,
    controlCount: reg.controls.length,
    ingestedFullText: reg.controls.some((c) => c.sourceText !== null),
  };
}
