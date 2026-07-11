// OAuth Compliance Connector — connection state machine.
//
// Pure, deterministic transitions over ConnectionStatus. Encapsulates the legal
// lifecycle moves so no caller can push a connection into an inconsistent state
// (e.g. reactivating a revoked connection). Every transition is validated; an
// illegal move throws.

import type { ConnectionStatus, ConnectionMode } from "./types";

/** Allowed status transitions. `revoked` is terminal. */
const STATUS_TRANSITIONS: Record<ConnectionStatus, ConnectionStatus[]> = {
  pending: ["active", "revoked"],
  active: ["degraded", "frozen", "revoked"],
  degraded: ["active", "frozen", "revoked"],
  frozen: ["active", "revoked"],
  revoked: [],
};

export function canTransition(from: ConnectionStatus, to: ConnectionStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Returns `to` if the transition is legal, otherwise throws. */
export function transition(from: ConnectionStatus, to: ConnectionStatus): ConnectionStatus {
  if (!canTransition(from, to)) {
    throw new Error(`illegal connection transition: ${from} -> ${to}`);
  }
  return to;
}

/**
 * Whether the agent may perform automated writes right now: only when the
 * connection is `active` AND in `auto` mode. `frozen`/`degraded`/`propose_only`
 * all block auto-writes (they fall back to proposing).
 */
export function canAutoWrite(status: ConnectionStatus, mode: ConnectionMode): boolean {
  return status === "active" && mode === "auto";
}

/** Whether the connection is in a state where monitoring should run. */
export function isMonitoring(status: ConnectionStatus): boolean {
  return status === "active" || status === "degraded" || status === "frozen";
}
