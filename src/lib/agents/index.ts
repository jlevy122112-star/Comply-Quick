// Agent accelerators — public surface.
//
// The compliance monitoring cycle chains the two agents: the Regulation Monitor
// sweeps every appropriate agency for real-world changes, then the Autopilot
// Remediation Agent offers each affected user a human-approvable edit plan.

import { runRegulationMonitor, type MonitorRunOptions } from "./regulation-monitor";
import { runAutopilotRemediation, type RemediationRunResult } from "./autopilot-remediation";
import { getAiClient, type AiClient } from "@/services/ai";
import type { AgentRunResult } from "./types";

export * from "./types";
export { runRegulationMonitor, detectChanges } from "./regulation-monitor";
export {
  runAutopilotRemediation,
  buildEditPlan,
  buildEditPlanStep,
  remediationUpdatesFromFindings,
  type EditPlanStep,
  type RemediationRunResult,
} from "./autopilot-remediation";
export { industriesForFramework, regionsForFramework, frameworksForIndustry } from "./classify";

export interface MonitoringCycleResult {
  monitor: AgentRunResult;
  remediation: RemediationRunResult;
}

/**
 * One full cycle: monitor → remediate. Intended for the scheduled job. The
 * remediation step only runs when the monitor found changes; both steps are
 * propose-only and require human approval before anything is applied.
 */
export async function runComplianceMonitoringCycle(
  options: MonitorRunOptions = {},
  ai: AiClient = getAiClient()
): Promise<MonitoringCycleResult> {
  const monitor = await runRegulationMonitor(options);
  const remediation = await runAutopilotRemediation(monitor.findings, ai);
  return { monitor, remediation };
}
