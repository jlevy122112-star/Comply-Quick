// OAuth Compliance Connector — circuit breaker.
//
// Guards auto-write mode. If a human repeatedly undoes the agent's automated
// fixes (a fight loop) or the agent's writes keep failing, the breaker trips:
// the connection is frozen and forced back to propose_only so the agent stops
// pushing changes until a human intervenes. Pure and deterministic — decisions
// are a function of the recent event window only.

export interface BreakerConfig {
  /** How many human-undo events within the window trips the breaker. */
  maxHumanUndos: number;
  /** How many consecutive write failures trips the breaker. */
  maxConsecutiveFailures: number;
  /** Sliding window length for counting undos. */
  windowMs: number;
}

export const DEFAULT_BREAKER: BreakerConfig = {
  maxHumanUndos: 3,
  maxConsecutiveFailures: 3,
  windowMs: 24 * 60 * 60 * 1000,
};

/** A signal the breaker reasons over. */
export interface BreakerSignal {
  kind: "human_undo" | "write_ok" | "write_failed";
  at: number; // epoch ms
}

export interface BreakerDecision {
  tripped: boolean;
  reason?: "repeated_human_undo" | "repeated_write_failure";
  humanUndosInWindow: number;
  consecutiveFailures: number;
}

/**
 * Evaluates the recent signal history and decides whether to trip.
 * `now` is injected for deterministic testing.
 */
export function evaluateBreaker(
  signals: BreakerSignal[],
  now: number,
  config: BreakerConfig = DEFAULT_BREAKER
): BreakerDecision {
  const windowStart = now - config.windowMs;
  const humanUndosInWindow = signals.filter((s) => s.kind === "human_undo" && s.at >= windowStart).length;

  // Consecutive write failures counted from the most recent write outcome backwards.
  let consecutiveFailures = 0;
  const writes = signals.filter((s) => s.kind === "write_ok" || s.kind === "write_failed").sort((a, b) => a.at - b.at);
  for (let i = writes.length - 1; i >= 0; i--) {
    if (writes[i].kind === "write_failed") consecutiveFailures += 1;
    else break;
  }

  if (humanUndosInWindow >= config.maxHumanUndos) {
    return { tripped: true, reason: "repeated_human_undo", humanUndosInWindow, consecutiveFailures };
  }
  if (consecutiveFailures >= config.maxConsecutiveFailures) {
    return { tripped: true, reason: "repeated_write_failure", humanUndosInWindow, consecutiveFailures };
  }
  return { tripped: false, humanUndosInWindow, consecutiveFailures };
}
