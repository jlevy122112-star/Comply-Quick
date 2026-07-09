// Success / Upsell Agent.
//
// Watches account health signals and proposes the next best action that both
// helps the user and grows revenue — nudging on scan-limit pressure, rising
// risk, pending regulatory work, and missing high-value modules. Pure and
// deterministic so nudges are testable and never fire spuriously. Tier names
// are passed through verbatim (never renamed).

import { action, orderPlan, type AgentActionPlan } from "./actions";

export interface AccountSignals {
  /** Current plan tier name (verbatim, e.g. "free", "solo", "agency"). */
  tier: string;
  /** Suggested next tier name to upgrade to, if any. */
  nextTier?: string;
  /** Scans used this period and the plan's limit. */
  scansUsed: number;
  scanLimit: number;
  /** Compliance score trend: negative means risk is rising. */
  scoreDelta: number;
  /** Pending (unapproved) regulatory proposals. */
  pendingProposals: number;
  /** Recommended modules the account has not enabled yet. */
  missingModules: string[];
}

export interface Nudge {
  /** Stable key so the UI can de-dupe / track dismissal. */
  key: string;
  message: string;
  /** Higher shows first. */
  priority: number;
}

const USAGE_WARN_RATIO = 0.8;

/** Pure: derives ranked nudges from account signals. */
export function successNudges(signals: AccountSignals): Nudge[] {
  const nudges: Nudge[] = [];
  const usageRatio = signals.scanLimit > 0 ? signals.scansUsed / signals.scanLimit : 0;

  if (usageRatio >= 1 && signals.nextTier) {
    nudges.push({
      key: "scan_limit_reached",
      message: `You've used all ${signals.scanLimit} scans this period. Upgrade to ${signals.nextTier} for more monitoring.`,
      priority: 90,
    });
  } else if (usageRatio >= USAGE_WARN_RATIO && signals.nextTier) {
    nudges.push({
      key: "scan_limit_near",
      message: `You're at ${Math.round(usageRatio * 100)}% of your scan limit — ${signals.nextTier} raises it.`,
      priority: 60,
    });
  }

  if (signals.scoreDelta < 0) {
    nudges.push({
      key: "risk_rising",
      message: `Your compliance score dropped ${Math.abs(signals.scoreDelta)} points. Review the new findings to recover it.`,
      priority: 80,
    });
  }

  if (signals.pendingProposals > 0) {
    nudges.push({
      key: "pending_proposals",
      message: `${signals.pendingProposals} regulatory update(s) are waiting for your approval.`,
      priority: 75,
    });
  }

  if (signals.missingModules.length > 0) {
    nudges.push({
      key: "missing_modules",
      message: `Enable ${signals.missingModules.length} recommended module(s) (${signals.missingModules.slice(0, 3).join(", ")}) to close coverage gaps.`,
      priority: 50,
    });
  }

  return nudges.sort((a, b) => b.priority - a.priority);
}

/** Wraps nudges into an approval-gated plan of concrete next actions. */
export function planSuccessActions(signals: AccountSignals): { nudges: Nudge[]; plan: AgentActionPlan } {
  const nudges = successNudges(signals);
  const actions = [];

  if (
    (signals.scansUsed / Math.max(1, signals.scanLimit) >= USAGE_WARN_RATIO || signals.scoreDelta < 0) &&
    signals.nextTier
  ) {
    actions.push(
      action(
        "upgrade_plan",
        `Upgrade to ${signals.nextTier} for more scans and monitoring headroom.`,
        { nextTier: signals.nextTier },
        30
      )
    );
  }
  if (signals.pendingProposals > 0) {
    actions.push(action("regenerate_documents", "Review and approve the pending regulatory updates.", {}, 25));
  }
  if (signals.scoreDelta < 0) {
    actions.push(action("run_scan", "Re-scan to confirm the current state of your compliance.", {}, 20));
  }
  if (signals.missingModules.length > 0) {
    actions.push(
      action(
        "configure_modules",
        "Enable the recommended modules to close coverage gaps.",
        { modules: signals.missingModules },
        15
      )
    );
  }

  const rationale =
    nudges.length > 0
      ? `${nudges.length} opportunity(ies) to reduce risk or unlock more value. Review and approve — nothing runs until you confirm.`
      : "Your account is healthy. No action needed right now.";

  return { nudges, plan: orderPlan({ agent: "success_upsell", title: "Recommended next steps", rationale, actions }) };
}
