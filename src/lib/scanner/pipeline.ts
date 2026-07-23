// Compliance Scanner pipeline (Phase 3).
//
// Ties the crawler + analyzer together and produces a plain-language summary via
// the AI client (with a deterministic fallback so a missing key never fails a
// scan). No DB access here; the caller persists the outcome.

import type { AiClient } from "@/services/ai";
import { scanPage } from "./crawler";
import { analyzeHtml, type DetectedTool, type Finding } from "./analyzer";
import { analyzeAccessibility, type AccessibilityAnalysis } from "./accessibility";

export interface ScanOutcome {
  url: string;
  score: number;
  detectedTools: DetectedTool[];
  findings: Finding[];
  summary: string;
  /** True when a headless render executed the page's JS (deeper tracker detection). */
  rendered: boolean;
  /** Accessibility results are separate from the privacy/tracker score and findings. */
  accessibility: AccessibilityAnalysis;
}

function buildSummaryPrompt(url: string, tools: DetectedTool[], findings: Finding[], score: number): string {
  const toolList = tools.map((t) => t.name).join(", ") || "none detected";
  const issues =
    findings
      .filter((f) => f.severity !== "info")
      .map((f) => `${f.severity}: ${f.title}`)
      .join("; ") || "none";
  return [
    `A website compliance scan just ran.`,
    `URL: ${url}`,
    `Compliance score: ${score}/100.`,
    `Third-party tools detected: ${toolList}.`,
    `Issues: ${issues}.`,
    ``,
    `Write a concise (2-4 sentence) plain-language summary for a non-lawyer business owner: what the biggest compliance risks are and the single most important next step. Be neutral and do not overstate risk.`,
  ].join("\n");
}

function fallbackSummary(tools: DetectedTool[], findings: Finding[], score: number): string {
  const critical = findings.filter((f) => f.severity === "critical");
  const lead =
    critical.length > 0
      ? `${critical.length} critical issue(s) found: ${critical.map((f) => f.title).join("; ")}.`
      : `No critical issues found.`;
  return `Compliance score ${score}/100. Detected ${tools.length} third-party tool(s). ${lead} Review the findings below and address critical items first.`;
}

/** Runs a full scan: fetch → analyze → summarize. */
export async function runScan(params: {
  url: string;
  ai: AiClient;
  fetchImpl?: typeof fetch;
  assertHost?: (hostname: string) => Promise<unknown>;
}): Promise<ScanOutcome> {
  const { url, ai, fetchImpl, assertHost } = params;
  const page = await scanPage(url, fetchImpl ?? fetch, assertHost);
  const analysis = analyzeHtml(page.html, page.requestUrls);
  const accessibility = analyzeAccessibility(page.html, page.accessibilityViolations);

  let summary: string;
  if (ai.live) {
    try {
      summary = (
        await ai.complete({
          system:
            "You are a web compliance analyst. Be precise, neutral, and never overstate risk. Output plain prose only.",
          prompt: buildSummaryPrompt(page.url, analysis.detectedTools, analysis.findings, analysis.score),
          temperature: 0.2,
          maxTokens: 220,
        })
      ).trim();
    } catch {
      summary = fallbackSummary(analysis.detectedTools, analysis.findings, analysis.score);
    }
  } else {
    summary = fallbackSummary(analysis.detectedTools, analysis.findings, analysis.score);
  }

  return {
    url: page.url,
    score: analysis.score,
    detectedTools: analysis.detectedTools,
    findings: analysis.findings,
    accessibility,
    summary,
    rendered: page.rendered,
  };
}
