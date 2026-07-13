// Browser helper for emitting client-side analytics events to the analytics API.
// Fire-and-forget: analytics must never block or break the UI.

export type ClientAnalyticsEvent =
  | "paywall_viewed"
  | "upgrade_cta_clicked"
  | "pricing_variant_seen"
  | "expansion_nudge_shown"
  | "expansion_nudge_clicked"
  | "churn_save_offer_shown"
  | "churn_save_offer_accepted"
  | "web_vital_reported"
  | "web_vital_budget_failed";

export function trackClientEvent(
  event: ClientAnalyticsEvent,
  properties?: Record<string, string | number | boolean | null>
): void {
  try {
    void fetch("/api/analytics/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, properties }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Swallow — never let analytics surface to the user.
  }
}

// Backward-compatible wrapper used by existing paywall call sites.
export function trackFunnel(
  event: Extract<ClientAnalyticsEvent, "paywall_viewed" | "upgrade_cta_clicked">,
  properties?: Record<string, string | number | boolean | null>
): void {
  trackClientEvent(event, properties);
}
