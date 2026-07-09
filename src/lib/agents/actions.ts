// Shared confirm-before-act action model for every agent.
//
// Agents never execute side effects directly from a plan. They emit an
// `AgentActionPlan` — an ordered list of proposed `AgentAction`s, each flagged
// `requiresApproval: true`. The UI renders the plan, the human confirms (all or
// per-action), and only then does the executor invoke the underlying service.
// This keeps every agent human-in-the-loop by construction.

export type AgentActionType =
  | "run_scan"
  | "generate_cookie_banner"
  | "generate_dpa"
  | "generate_policy"
  | "generate_subprocessor_map"
  | "schedule_review"
  | "regenerate_documents"
  | "compile_evidence"
  | "draft_client_report"
  | "configure_modules"
  | "upgrade_plan"
  | "review_output";

/** Human-readable label + which service the executor routes each action to. */
export const ACTION_META: Record<AgentActionType, { label: string; service: string }> = {
  run_scan: { label: "Run a compliance scan", service: "scanner" },
  generate_cookie_banner: { label: "Generate a cookie-consent banner", service: "tools" },
  generate_dpa: { label: "Generate a Data Processing Agreement", service: "tools" },
  generate_policy: { label: "Generate a privacy policy / addendum", service: "clauseEngine" },
  generate_subprocessor_map: { label: "Generate a subprocessor map", service: "tools" },
  schedule_review: { label: "Schedule a compliance review", service: "calendar" },
  regenerate_documents: { label: "Regenerate affected documents", service: "autopilot" },
  compile_evidence: { label: "Compile an audit evidence pack", service: "audit" },
  draft_client_report: { label: "Draft a client-ready report", service: "portfolio" },
  configure_modules: { label: "Enable recommended compliance modules", service: "projects" },
  upgrade_plan: { label: "Upgrade your plan", service: "billing" },
  review_output: { label: "Resolve output quality issues before release", service: "qa" },
};

export interface AgentAction {
  type: AgentActionType;
  /** Concise, human-readable description of exactly what will happen. */
  label: string;
  detail: string;
  /** Free-form params the executor needs (validated at execution time). */
  params: Record<string, string | number | boolean | string[]>;
  /** Every agent action is gated on explicit human approval. */
  requiresApproval: true;
  /** Priority for ordering the plan; higher runs/shows first. */
  priority: number;
}

export interface AgentActionPlan {
  agent: string;
  title: string;
  /** Why the agent is proposing this plan (shown to the user). */
  rationale: string;
  actions: AgentAction[];
}

export function action(
  type: AgentActionType,
  detail: string,
  params: AgentAction["params"] = {},
  priority = 1
): AgentAction {
  return { type, label: ACTION_META[type].label, detail, params, requiresApproval: true, priority };
}

/** Orders a plan's actions by descending priority (stable). */
export function orderPlan(plan: AgentActionPlan): AgentActionPlan {
  return { ...plan, actions: [...plan.actions].sort((a, b) => b.priority - a.priority) };
}
