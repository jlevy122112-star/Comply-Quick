// Browser helper for emitting funnel events to the analytics endpoint.
// Fire-and-forget: analytics must never block or break the UI.

export type ClientFunnelEvent = "paywall_viewed" | "upgrade_cta_clicked";

export function trackFunnel(
  event: ClientFunnelEvent,
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
