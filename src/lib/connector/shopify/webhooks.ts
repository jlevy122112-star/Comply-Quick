// OAuth Compliance Connector — Shopify webhook verification + routing.
//
// Shopify signs every webhook body with the app secret (base64 HMAC-SHA256 in
// the X-Shopify-Hmac-Sha256 header). We verify it with a constant-time compare
// before trusting the payload, then map the topic to the connector's internal
// event type so the continuous agent loop can react.

import { createHmac, timingSafeEqual } from "node:crypto";
import type { ConnectionEventType } from "../types";

/**
 * Verifies a Shopify webhook body against the header HMAC.
 * `rawBody` MUST be the exact bytes received (not a re-serialized object).
 */
export function verifyWebhookHmac(rawBody: string, headerHmac: string | undefined, apiSecret: string): boolean {
  if (!headerHmac) return false;
  const digest = createHmac("sha256", apiSecret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(digest, "base64");
  const b = Buffer.from(headerHmac, "base64");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Shopify webhook topics the compliance agent subscribes to. */
export const SUBSCRIBED_TOPICS = [
  "app/uninstalled",
  "themes/publish",
  "themes/update",
  "app_subscriptions/update",
  "shop/update",
] as const;

/** Maps a Shopify topic to the connector's internal event type. */
export function mapTopicToEvent(topic: string): ConnectionEventType {
  if (topic === "app/uninstalled") return "token";
  if (topic.startsWith("themes/")) return "webhook";
  return "webhook";
}

/** True when a topic should trigger a re-scan of the connected site. */
export function shouldRescan(topic: string): boolean {
  return topic.startsWith("themes/") || topic === "shop/update";
}
