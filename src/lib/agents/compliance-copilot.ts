// Compliance Copilot Agent.
//
// The action-taking upgrade of the chat assistant: it interprets a user's intent
// and proposes an ordered action plan (run scan, generate banner/DPA/policy,
// schedule review) — always confirm-before-act. Pure intent→plan mapping so it's
// deterministic and testable; execution of approved actions is delegated to the
// existing services by the executor.

import { action, orderPlan, type AgentActionPlan, type AgentAction } from "./actions";

export interface CopilotContext {
  projectId?: string;
  /** Whether the project already has a recent scan (affects whether we scan first). */
  hasRecentScan?: boolean;
  /** Whether a consent banner already exists (avoid redundant generation). */
  hasConsentBanner?: boolean;
}

/** Keyword → intent detection over the user's message. Order = specificity. */
function detectActions(message: string, ctx: CopilotContext): AgentAction[] {
  const m = message.toLowerCase();
  const out: AgentAction[] = [];
  const pid = ctx.projectId ?? "";

  if (/scan|check|audit my site|analy[sz]e/.test(m) || (!ctx.hasRecentScan && /complian(t|ce)/.test(m))) {
    out.push(action("run_scan", "Scan the site to detect trackers and compliance gaps.", { projectId: pid }, 30));
  }
  if (/cookie|consent|banner|cmp/.test(m) && !ctx.hasConsentBanner) {
    out.push(
      action("generate_cookie_banner", "Generate a consent banner for the detected trackers.", { projectId: pid }, 20)
    );
  }
  if (/dpa|processor|processing agreement/.test(m)) {
    out.push(action("generate_dpa", "Generate a Data Processing Agreement.", { projectId: pid }, 18));
  }
  if (/policy|privacy|disclosure|notice/.test(m)) {
    out.push(action("generate_policy", "Generate a privacy policy / addendum.", { projectId: pid }, 16));
  }
  if (/subprocessor|data flow|vendor map/.test(m)) {
    out.push(action("generate_subprocessor_map", "Generate a subprocessor map.", { projectId: pid }, 14));
  }
  if (/schedule|review|remind|calendar|quarterly|annual/.test(m)) {
    out.push(action("schedule_review", "Schedule a recurring compliance review.", { projectId: pid }, 10));
  }
  return out;
}

/**
 * Builds an action plan for a natural-language request. If nothing specific is
 * detected, proposes a sensible default: scan first, then schedule a review —
 * the highest-retention starting workflow for a new project.
 */
export function planCopilotActions(message: string, ctx: CopilotContext = {}): AgentActionPlan {
  let actions = detectActions(message, ctx);

  if (actions.length === 0) {
    const pid = ctx.projectId ?? "";
    actions = [
      action("run_scan", "Establish a compliance baseline by scanning the site.", { projectId: pid }, 30),
      action("schedule_review", "Schedule a recurring review so compliance stays current.", { projectId: pid }, 10),
    ];
  }

  const rationale = `I can take ${actions.length} action(s) for you. Review and approve — nothing runs until you confirm.`;
  return orderPlan({ agent: "compliance_copilot", title: "Proposed actions", rationale, actions });
}
