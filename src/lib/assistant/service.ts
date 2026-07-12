// Compliance AI Assistant (build-plan P7).
//
// Grounds a general-purpose compliance assistant in Comply-Quick's own
// capabilities and canonical datasets so answers are consistent with what the
// app can actually generate. The system prompt is DERIVED from the live
// datasets (frameworks, pixels, regions, modules) — add a region or pixel and
// the assistant automatically knows about it.

import { FRAMEWORKS, TRACKING_PIXELS, TARGET_REGIONS } from "@/components/ClauseEngine";
import { COMPLIANCE_MODULES } from "@/components/EnterpriseModules";
import { REGION_RULES, PIXEL_VENDORS } from "@/lib/tools/data";
import { alertsDigest } from "@/lib/regulations/alerts";
import { getAiClient } from "@/services/ai";

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantContext {
  tier?: string;
  projectCount?: number;
  frameworks?: string[];
}

export interface AssistantReply {
  reply: string;
  /** True when produced by a live model; false for the grounded fallback. */
  live: boolean;
}

const MAX_HISTORY = 12;
const MAX_MESSAGE_CHARS = 4000;

/** Builds the grounding system prompt from the live compliance datasets. */
export function buildSystemPrompt(context?: AssistantContext): string {
  const regions = TARGET_REGIONS.map(
    (r) => `${REGION_RULES[r].name} (${REGION_RULES[r].law}, ${REGION_RULES[r].consentModel})`
  ).join("; ");
  const pixels = TRACKING_PIXELS.map((p) => `${PIXEL_VENDORS[p].name} (${PIXEL_VENDORS[p].company})`).join("; ");
  const ctx = context
    ? `\nUser context: tier=${context.tier ?? "unknown"}, projects=${context.projectCount ?? 0}${
        context.frameworks?.length ? `, stacks=${context.frameworks.join(", ")}` : ""
      }.`
    : "";

  const digest = alertsDigest();
  const regulatory = digest
    ? [
        "",
        "Current regulatory developments to reference when relevant (do not fabricate beyond these; cite the linked source):",
        digest,
      ].join("\n")
    : "";

  return [
    "You are the Comply-Quick Compliance Assistant, an expert guide for web developers, agencies, and merchants on privacy and web-compliance topics (GDPR, CCPA/CPRA, LGPD, PIPEDA, Australian Privacy Principles, ADA/WCAG, HIPAA, PCI-DSS, SOC 2).",
    "You help users understand their obligations AND drive them to the right in-app tool. Be concise, practical, and specific. Use short paragraphs or bullet lists.",
    "",
    "What Comply-Quick can generate for the user (always point them to the relevant tool):",
    `- Compliance packages (liability waiver + privacy policy + pre-launch checklist) via the generator wizard at /dashboard.`,
    `- Cookie consent banners at /dashboard/tools/cookie-banner.`,
    `- Cookie policies (jurisdiction-aware disclosures with a per-vendor technology table) at /dashboard/tools/cookie-policy.`,
    `- Data Processing Agreements (DPAs) at /dashboard/tools/dpa.`,
    `- Subprocessor registers at /dashboard/tools/subprocessors.`,
    `- URL compliance scans from the Command Center scanner.`,
    "",
    `Supported platforms: ${FRAMEWORKS.join(", ")}.`,
    `Supported jurisdictions: ${regions}.`,
    `Tracking pixels understood: ${pixels}.`,
    `Enterprise modules: ${COMPLIANCE_MODULES.join(", ")}.`,
    "",
    "Rules: Never claim to give legal advice — add a brief reminder that outputs are not legal advice for consequential questions. Do not invent regulations or citations. If a question is outside privacy/web-compliance, briefly redirect. When a user asks 'what should I do', give a concrete next step tied to a specific tool above.",
    regulatory,
    ctx,
  ].join("\n");
}

/** Flattens the conversation into a single prompt for the completion API. */
function renderConversation(messages: AssistantMessage[]): string {
  const recent = messages.slice(-MAX_HISTORY);
  const lines = recent.map(
    (m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, MAX_MESSAGE_CHARS)}`
  );
  lines.push("Assistant:");
  return lines.join("\n\n");
}

/**
 * Grounded fallback used when no live model is configured. Gives a genuinely
 * useful, dataset-derived answer instead of an error so the feature works in
 * local/CI environments without an API key.
 */
function groundedFallback(messages: AssistantMessage[]): string {
  const last =
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content.toLowerCase() ?? "";
  const mentions = (words: string[]) => words.some((w) => last.includes(w));

  if (mentions(["cookie", "consent", "banner"])) {
    return "For cookie consent, use the Cookie Consent Banner tool (/dashboard/tools/cookie-banner). It picks the correct model automatically: opt-in for GDPR/LGPD, opt-out (Do Not Sell) for CCPA, and notice-only for US-general — based on the jurisdictions you select. Pair it with the Cookie Policy generator (/dashboard/tools/cookie-policy) to disclose exactly which technologies you run. This is general information, not legal advice.";
  }
  if (mentions(["dpa", "processing agreement", "processor"])) {
    return "A Data Processing Agreement governs how a processor handles personal data for a controller. Generate one at /dashboard/tools/dpa — it fills in governing-law clauses per jurisdiction and a subprocessor annex from your tracking pixels. Not legal advice.";
  }
  if (mentions(["subprocessor", "vendor", "data flow"])) {
    return "Map where customer data flows with the Subprocessor Mapping tool (/dashboard/tools/subprocessors). It builds a GDPR Art. 30-style register (vendor, purpose, data categories, opt-out) you can drop into a DPA annex. Not legal advice.";
  }
  if (mentions(["scan", "audit", "check my site"])) {
    return "Run the URL scanner from your Command Center to auto-detect trackers and missing disclosures, then generate the matching compliance package. Not legal advice.";
  }
  return "I can help with GDPR, CCPA, LGPD, PIPEDA, HIPAA, PCI-DSS and more — and point you to the right tool. Try: generate a compliance package (/dashboard), a cookie banner (/dashboard/tools/cookie-banner), a cookie policy (/dashboard/tools/cookie-policy), a DPA (/dashboard/tools/dpa), or a subprocessor register (/dashboard/tools/subprocessors). (A live model isn't configured in this environment, so this is a grounded summary, not model-generated. Not legal advice.)";
}

/** Answers a conversation turn, using the live model when available. */
export async function answerAssistant(
  messages: AssistantMessage[],
  context?: AssistantContext
): Promise<AssistantReply> {
  const client = getAiClient();
  if (!client.live) {
    return { reply: groundedFallback(messages), live: false };
  }
  const reply = await client.complete({
    system: buildSystemPrompt(context),
    prompt: renderConversation(messages),
    maxTokens: 500,
    temperature: 0.3,
  });
  return { reply: reply.trim(), live: true };
}
