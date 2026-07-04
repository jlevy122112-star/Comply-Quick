// Auto-regeneration pipeline (Phase 2, propose-only).
//
// Given a project's saved inputs and a regulation that changed, regenerate the
// compliance package with the current ClauseEngine, diff it against what the
// user has stored, and produce a *proposed* document version + a plain-language
// summary. Nothing here writes to the DB or mutates the live project — the
// caller persists the proposal with status 'proposed' for the user to approve.

import {
  generateCompliancePackage,
  exportToMarkdown,
  type Framework,
  type TrackingPixel,
  type TargetRegion,
  type ComplianceModule,
  type ComplianceScore,
} from "@/components/ClauseEngine";
import type { AiClient } from "@/services/ai";
import { computePackageDiff, type DocumentDiff } from "./diff-engine";

// Projects do not persist the wizard's userType; regeneration assumes the
// developer perspective (the product's primary audience).
const DEFAULT_USER_TYPE = "developer" as const;

export interface ProjectInputsSnapshot {
  name: string;
  framework: Framework;
  trackingPixels: TrackingPixel[];
  targetRegions: TargetRegion[];
  complianceModules: ComplianceModule[];
  packageMarkdown: string;
}

export interface RegulationContext {
  id: string;
  name: string;
  region: string;
  changeNote: string;
}

export interface RegenerationProposal {
  /** True when the regenerated package differs from the stored one. */
  hasChanges: boolean;
  summary: string;
  diff: DocumentDiff;
  packageMarkdown: string;
  complianceScore: ComplianceScore;
}

function buildSummaryPrompt(project: ProjectInputsSnapshot, regulation: RegulationContext, diff: DocumentDiff): string {
  const changed = [...diff.changedSections, ...diff.addedSections].slice(0, 12).join(", ") || "none";
  return [
    `A tracked regulation changed and a compliance package was regenerated.`,
    `Project: ${project.name} (framework: ${project.framework}).`,
    `Regulation: ${regulation.name} (${regulation.region}).`,
    `Regulator change note: ${regulation.changeNote}`,
    `Sections affected in the regenerated document: ${changed}.`,
    `Added ${diff.addedLines} lines, removed ${diff.removedLines} lines.`,
    ``,
    `Write a concise (2-4 sentence) plain-language summary for a non-lawyer explaining what changed and why they should review it. Do NOT claim the change is auto-applied; it is a proposal awaiting their approval.`,
  ].join("\n");
}

/** Deterministic summary used when the AI client is unavailable. */
function fallbackSummary(regulation: RegulationContext, diff: DocumentDiff): string {
  const sections = [...diff.changedSections, ...diff.addedSections];
  const detail = sections.length > 0 ? ` Affected sections: ${sections.slice(0, 6).join(", ")}.` : "";
  return (
    `${regulation.name} (${regulation.region}) changed, so we regenerated a proposed update to this project's ` +
    `compliance package (+${diff.addedLines}/-${diff.removedLines} lines).${detail} Review and approve to apply it.`
  );
}

/**
 * Regenerates the package for a project and produces a review proposal. Uses the
 * AI client for a human-readable summary, falling back to a deterministic one so
 * the pipeline never fails on a missing key.
 */
export async function buildRegenerationProposal(params: {
  project: ProjectInputsSnapshot;
  regulation: RegulationContext;
  ai: AiClient;
}): Promise<RegenerationProposal> {
  const { project, regulation, ai } = params;

  const pkg = generateCompliancePackage({
    userType: DEFAULT_USER_TYPE,
    framework: project.framework,
    trackingPixels: project.trackingPixels,
    targetRegions: project.targetRegions,
    complianceModules: project.complianceModules,
  });
  const packageMarkdown = exportToMarkdown(pkg);
  const diff = computePackageDiff(project.packageMarkdown, packageMarkdown);

  let summary: string;
  if (!diff.identical && ai.live) {
    try {
      summary = (
        await ai.complete({
          system:
            "You are a compliance analyst. Be precise, neutral, and never overstate risk. Output plain prose only.",
          prompt: buildSummaryPrompt(project, regulation, diff),
          temperature: 0.2,
          maxTokens: 220,
        })
      ).trim();
    } catch {
      summary = fallbackSummary(regulation, diff);
    }
  } else {
    summary = diff.identical
      ? `${regulation.name} changed but this project's package is already up to date; no action needed.`
      : fallbackSummary(regulation, diff);
  }

  return {
    hasChanges: !diff.identical,
    summary,
    diff,
    packageMarkdown,
    complianceScore: pkg.complianceScore,
  };
}
