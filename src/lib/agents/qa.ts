// QA Agent.
//
// The last gate before a generated output is released/exported. It checks a
// document for completeness and integrity — required sections present, no unfilled
// placeholders, source attribution present, non-trivial length — and blocks
// release (proposing a fix action) when the output isn't audit-ready. Pure and
// deterministic so the release gate is reproducible.

import { action, orderPlan, type AgentActionPlan } from "./actions";

export type QaSeverity = "blocker" | "warning";

export interface QaIssue {
  code: string;
  message: string;
  severity: QaSeverity;
}

export interface QaInput {
  /** The generated document body. */
  content: string;
  /** Section headings the document type must contain. */
  requiredSections?: string[];
  /** Whether the document must cite a source (regulatory outputs must). */
  requiresSource?: boolean;
  /** Minimum acceptable length in characters. */
  minLength?: number;
}

export interface QaReport {
  passed: boolean;
  issues: QaIssue[];
  /** Present only when release is blocked. */
  plan?: AgentActionPlan;
}

// Matches common unfilled-placeholder markers: [TODO], {{name}}, <insert x>, TBD, XXX, lorem ipsum.
const PLACEHOLDER =
  /\[[^\]]*(todo|placeholder|insert|tbd|xxx)[^\]]*\]|\{\{[^}]+\}\}|<[^>]*insert[^>]*>|\bTBD\b|\bXXX\b|lorem ipsum/i;

/** Pure: reviews a generated output and reports completeness issues. */
export function reviewOutput(input: QaInput): QaReport {
  const issues: QaIssue[] = [];
  const content = input.content ?? "";
  const minLength = input.minLength ?? 200;

  if (content.trim().length < minLength) {
    issues.push({
      code: "too_short",
      message: `Output is shorter than the ${minLength}-char minimum.`,
      severity: "blocker",
    });
  }

  const missing = (input.requiredSections ?? []).filter(
    (section) => !content.toLowerCase().includes(section.toLowerCase())
  );
  for (const section of missing) {
    issues.push({ code: "missing_section", message: `Required section missing: "${section}".`, severity: "blocker" });
  }

  if (PLACEHOLDER.test(content)) {
    issues.push({
      code: "unfilled_placeholder",
      message: "Output contains an unfilled placeholder.",
      severity: "blocker",
    });
  }

  if (input.requiresSource && !/https?:\/\//.test(content)) {
    issues.push({
      code: "no_source",
      message: "Regulatory output must cite an official source link.",
      severity: "warning",
    });
  }

  const passed = !issues.some((i) => i.severity === "blocker");
  if (passed) return { passed, issues };

  const plan = orderPlan({
    agent: "qa",
    title: "Fix before release",
    rationale: `Found ${issues.length} quality issue(s). Release is blocked until the blockers are resolved.`,
    actions: [
      action(
        "review_output",
        `Resolve ${issues.filter((i) => i.severity === "blocker").length} blocker(s): ${issues.map((i) => i.code).join(", ")}.`,
        { issues: issues.map((i) => i.code) },
        30
      ),
    ],
  });

  return { passed, issues, plan };
}
