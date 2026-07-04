// Regulation diff engine (Phase 2, propose-only).
//
// Pure, dependency-free logic: detect when a tracked regulation's source has
// changed, and summarize how a regenerated compliance package differs from the
// one currently stored on a project. No DB, no AI, no network — so it is fully
// unit-testable and safe to run in an Edge Function.

import { createHash } from "node:crypto";

/** Stable SHA-256 hex of the tracked regulation source. */
export function hashContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export interface RegulationSnapshot {
  version: number;
  contentHash: string | null;
}

export interface RegulationChange {
  changed: boolean;
  previousHash: string | null;
  nextHash: string;
  nextVersion: number;
}

/**
 * Detects whether incoming regulation content differs from the last snapshot.
 * A missing previous hash counts as a change (first observation).
 */
export function detectRegulationChange(previous: RegulationSnapshot | null, incomingContent: string): RegulationChange {
  const nextHash = hashContent(incomingContent);
  const previousHash = previous?.contentHash ?? null;
  const changed = previousHash !== nextHash;
  return {
    changed,
    previousHash,
    nextHash,
    nextVersion: (previous?.version ?? 0) + 1,
  };
}

export interface DocumentDiff {
  /** Section headings present in the new package but not the old. */
  addedSections: string[];
  /** Section headings present in the old package but not the new. */
  removedSections: string[];
  /** Section headings whose body text changed. */
  changedSections: string[];
  addedLines: number;
  removedLines: number;
  /** True when nothing changed between the two markdown documents. */
  identical: boolean;
}

interface Section {
  heading: string;
  body: string;
}

/** Splits a markdown document into sections keyed by their heading line. */
function splitSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: Section = { heading: "(preamble)", body: "" };
  const flush = () => sections.set(current.heading, current.body.trim());

  for (const line of markdown.split("\n")) {
    if (/^#{1,6}\s+/.test(line)) {
      flush();
      current = { heading: line.replace(/^#{1,6}\s+/, "").trim(), body: "" };
    } else {
      current.body += line + "\n";
    }
  }
  flush();
  return sections;
}

/** Compares two package markdown documents section-by-section. */
export function computePackageDiff(oldMarkdown: string, newMarkdown: string): DocumentDiff {
  const oldSections = splitSections(oldMarkdown);
  const newSections = splitSections(newMarkdown);

  const addedSections: string[] = [];
  const removedSections: string[] = [];
  const changedSections: string[] = [];

  for (const [heading, body] of newSections) {
    if (!oldSections.has(heading)) addedSections.push(heading);
    else if (oldSections.get(heading) !== body) changedSections.push(heading);
  }
  for (const heading of oldSections.keys()) {
    if (!newSections.has(heading)) removedSections.push(heading);
  }

  const oldLines = new Set(oldMarkdown.split("\n"));
  const newLines = new Set(newMarkdown.split("\n"));
  let addedLines = 0;
  let removedLines = 0;
  for (const l of newLines) if (!oldLines.has(l)) addedLines += 1;
  for (const l of oldLines) if (!newLines.has(l)) removedLines += 1;

  return {
    addedSections,
    removedSections,
    changedSections,
    addedLines,
    removedLines,
    identical:
      addedSections.length === 0 &&
      removedSections.length === 0 &&
      changedSections.length === 0 &&
      oldMarkdown === newMarkdown,
  };
}
