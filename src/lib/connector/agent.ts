// OAuth Compliance Connector — continuous agent cycle (pure orchestration).
//
// One deterministic evaluation of the "connected" loop: given what a re-scan
// found on the connected site, what the site's documents currently cover, the
// connection's mode/status, and the recent breaker signals, decide the
// obligations, the lint findings, the remediation plan, and whether the circuit
// breaker should trip (and thus force the connection back to propose_only).
// Pure and dependency-injected (no network/DB) so the whole decision is
// unit-testable; callers wire the scan + persistence around it.

import { deriveObligations, type ObligationResult } from "@/lib/compliance/traverse";
import { lintCompliance, type ComplianceState, type LintFinding } from "@/lib/compliance/linter";
import type { JurisdictionId } from "@/lib/compliance/graph";
import { planRemediations, type PlannedRemediation } from "./remediation";
import { canTransition } from "./state-machine";
import {
  evaluateBreaker,
  type BreakerSignal,
  type BreakerDecision,
  type BreakerConfig,
  DEFAULT_BREAKER,
} from "./circuit-breaker";
import type { Connection, ConnectionMode, ConnectionStatus } from "./types";

/** What the connected site's documents currently cover (everything but the detected services). */
export type CoverageState = Omit<ComplianceState, "services" | "jurisdictions">;

export interface CycleInput {
  connection: Pick<Connection, "mode" | "status">;
  /** Service ids the re-scan detected on the connected site. */
  detectedServices: string[];
  jurisdictions: JurisdictionId[];
  coverage: CoverageState;
  /** Recent breaker signals (human undos + write outcomes). */
  breakerSignals: BreakerSignal[];
  now: number;
  breakerConfig?: BreakerConfig;
}

export interface CycleResult {
  obligations: ObligationResult[];
  findings: LintFinding[];
  plan: PlannedRemediation[];
  breaker: BreakerDecision;
  /** Mode/status the connection should move to after this cycle. */
  nextMode: ConnectionMode;
  nextStatus: ConnectionStatus;
}

/**
 * Evaluates one compliance cycle for a connected site.
 *
 * If the circuit breaker trips, the connection is forced to `frozen` +
 * `propose_only` and the plan is downgraded to proposals only (no auto-apply),
 * so the agent stops pushing writes until a human intervenes.
 */
export function evaluateConnectionCycle(input: CycleInput): CycleResult {
  const obligations = deriveObligations({ services: input.detectedServices, jurisdictions: input.jurisdictions });
  const findings = lintCompliance({
    ...input.coverage,
    services: input.detectedServices,
    jurisdictions: input.jurisdictions,
  });

  const breaker = evaluateBreaker(input.breakerSignals, input.now, input.breakerConfig ?? DEFAULT_BREAKER);

  // Freeze only when the breaker trips AND the state machine permits it (a
  // pending/revoked connection can't be frozen). If freezing is illegal we keep
  // the current status and never force propose_only off an invalid transition.
  const freeze = breaker.tripped && canTransition(input.connection.status, "frozen");
  const nextStatus: ConnectionStatus = freeze ? "frozen" : input.connection.status;
  const nextMode: ConnectionMode = freeze ? "propose_only" : input.connection.mode;

  const plan = planRemediations(findings, { mode: nextMode, status: nextStatus });

  return { obligations, findings, plan, breaker, nextMode, nextStatus };
}
