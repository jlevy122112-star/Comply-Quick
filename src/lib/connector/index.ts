// OAuth Compliance Connector — public surface.
//
// Continuous per-site compliance: connection lifecycle (state machine), token
// encryption, circuit breaker, remediation planning, the pure agent cycle, and
// the Shopify reference integration. See individual modules for details.

export * from "./types";
export * from "./crypto";
export * from "./state-machine";
export * from "./circuit-breaker";
export * from "./remediation";
export * from "./executor";
export * from "./agent";
export * as shopifyOAuth from "./shopify/oauth";
export * as shopifyWebhooks from "./shopify/webhooks";
export { ShopifyAdminClient } from "./shopify/client";
export type { ShopifyClientConfig, ScriptTag, ShopifyPage } from "./shopify/client";
