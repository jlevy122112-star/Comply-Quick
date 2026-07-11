// OAuth Compliance Connector — core types (framework phase).
//
// Shared, dependency-free type definitions for the continuous-compliance
// connector: platforms, connection lifecycle, remediation change sets, and the
// append-only audit ledger. Kept pure so the state machine, circuit breaker,
// and remediation planner are all unit-testable in isolation.

/** Platforms the connector can integrate with (Shopify is the reference). */
export type Platform = "shopify" | "gtm" | "woocommerce" | "webflow" | "bigcommerce" | "hubspot" | "ga4" | "klaviyo";

/** Whether a platform integration can write back or only observe. */
export type CapabilityClass = "read_write" | "monitor_only";

/**
 * Connection mode.
 * - `propose_only` (default): the agent stages drafts/alerts; the user publishes.
 * - `auto`: the agent applies fixes automatically (guarded by the circuit breaker).
 */
export type ConnectionMode = "propose_only" | "auto";

/**
 * Connection lifecycle status.
 * - `pending`: OAuth started, not yet authorized.
 * - `active`: authorized and monitoring.
 * - `degraded`: token expired/revoked or repeated write failures — monitoring paused.
 * - `frozen`: circuit breaker tripped; forced back to propose_only, awaiting user.
 * - `revoked`: user disconnected; monitoring stopped.
 */
export type ConnectionStatus = "pending" | "active" | "degraded" | "frozen" | "revoked";

export interface Connection {
  id: string;
  /** Owning agency (hierarchical agency ownership). */
  agencyOrgId: string;
  /** Optional restricted client seat that can view this connection. */
  clientSeatId?: string;
  platform: Platform;
  /** External account identifier (e.g. Shopify shop domain). */
  externalAccountId: string;
  status: ConnectionStatus;
  mode: ConnectionMode;
  scopes: string[];
  createdAt: string;
  lastVerifiedAt?: string;
}

/** A single proposed or applied change to the connected site. */
export interface RemediationChange {
  /** Stable id, e.g. "inject_consent_banner", "publish_privacy_policy". */
  id: string;
  /** Human-readable summary of the change. */
  summary: string;
  /** The obligation (graph node id) this change satisfies. */
  obligationId?: string;
  /** Target resource on the platform, e.g. "script_tag", "page:privacy". */
  target: string;
  /** Risk band — drives auto vs. propose gating and rollback strategy. */
  risk: "low" | "medium" | "high";
}

export type RemediationStatus = "proposed" | "applied" | "failed" | "reverted";

export interface Remediation {
  id: string;
  connectionId: string;
  triggerEventId: string;
  changes: RemediationChange[];
  status: RemediationStatus;
  createdAt: string;
  appliedAt?: string;
}

/** What woke the agent. */
export type ConnectionEventType = "webhook" | "regulation" | "heartbeat" | "token" | "user";

export interface ConnectionEvent {
  id: string;
  connectionId: string;
  type: ConnectionEventType;
  /** Free-form structured payload reference (opaque here). */
  payloadRef?: string;
  receivedAt: string;
}

/** Actor that performed an audited action. */
export type AuditActor = "agent" | "user" | "system";

/** Append-only audit ledger entry — never mutated, only inserted. */
export interface AuditEntry {
  id: string;
  connectionId: string;
  actor: AuditActor;
  action: string;
  /** Prior state snapshot ref for rollback (immutable). */
  previousStateRef?: string;
  /** Whether the action succeeded. */
  ok: boolean;
  at: string;
}
