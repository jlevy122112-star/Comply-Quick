// Compliance Intelligence — AI "Fix It" recommender (Phase 4).
//
// Turns an alert into a concrete, prioritized remediation plan. Uses the shared
// AiClient when a key is present and falls back to a deterministic, rule-based
// recommendation so a missing key (or a model error) never blocks the feature.

import type { AiClient } from "@/services/ai";
import type { RiskType } from "./risk";

export interface FixInput {
  url: string;
  type: RiskType | "scan_failed" | "info";
  title: string;
  body: string;
  detail: Record<string, unknown>;
}

function buildPrompt(input: FixInput): string {
  return [
    `A monitored website triggered a compliance alert.`,
    `URL: ${input.url}`,
    `Alert: ${input.title}`,
    `Context: ${input.body}`,
    `Structured detail: ${JSON.stringify(input.detail).slice(0, 800)}`,
    ``,
    `Give the site owner a short, concrete remediation plan: 2-4 numbered steps, plain language, no legal jargon, most important first. Do not overstate risk.`,
  ].join("\n");
}

function fallbackRecommendation(input: FixInput): string {
  switch (input.type) {
    case "new_tracker": {
      const tools = Array.isArray(input.detail.newTools)
        ? (input.detail.newTools as { name?: string }[]).map((t) => t.name).filter(Boolean)
        : [];
      const list = tools.length ? ` (${tools.join(", ")})` : "";
      return [
        `1. Confirm which team/plugin added the new tracker${list} and whether it is intended.`,
        `2. Add a disclosure for it to your privacy policy (what it collects and why).`,
        `3. Ensure your consent banner blocks it until the visitor opts in — do not let it fire on page load.`,
      ].join("\n");
    }
    case "requirement_lost": {
      const requirements = Array.isArray(input.detail.requirements)
        ? (input.detail.requirements as { recommendation?: string }[])
        : [];
      const actions = requirements
        .map(
          (requirement, index) =>
            index +
            1 +
            ". " +
            (requirement.recommendation ?? "Restore the missing requirement and verify it is publicly reachable.")
        )
        .slice(0, 3);
      return [
        ...actions,
        actions.length + 1 + ". Re-scan the site after deployment to confirm the requirement is detected again.",
      ].join("\n");
    }
    case "new_critical":
      return [
        `1. Open the finding below and read its recommendation.`,
        `2. Address the critical item first (e.g. publish/link a privacy policy or fix consent gating).`,
        `3. Re-run the scan to confirm the issue clears.`,
      ].join("\n");
    case "score_drop":
      return [
        `1. Compare this scan's findings with the previous one to see what changed.`,
        `2. Fix any newly-introduced critical or warning items.`,
        `3. Re-scan to confirm the score recovers.`,
      ].join("\n");
    case "scan_failed":
      return [
        `1. Check the site is publicly reachable (not password-gated or blocking bots).`,
        `2. Verify the URL is correct and returns a 200 response.`,
        `3. The monitor will retry on its next scheduled run.`,
      ].join("\n");
    default:
      return `Review the alert detail and address the highest-severity items first, then re-scan to confirm.`;
  }
}

/**
 * Produces a remediation plan for an alert. Prefers the live model; falls back
 * to a deterministic rule-based plan when the model is unavailable or errors.
 */
export async function buildFixRecommendation(input: FixInput, ai: AiClient): Promise<string> {
  if (!ai.live) return fallbackRecommendation(input);
  try {
    const out = await ai.complete({
      system:
        "You are a web compliance analyst. Be precise, neutral, and never overstate risk. Output a short numbered remediation plan only.",
      prompt: buildPrompt(input),
      temperature: 0.2,
      maxTokens: 220,
    });
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : fallbackRecommendation(input);
  } catch {
    return fallbackRecommendation(input);
  }
}
