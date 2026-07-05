// app/lib/telemetry.ts

export type TelemetryPayload = Record<string, unknown>;

const TELEMETRY_ENABLED = true; // flip if you want to disable in dev

function logEvent(kind: "event" | "error", name: string, payload: TelemetryPayload = {}) {
  if (!TELEMETRY_ENABLED) return;
  // Wire this to Posthog, Supabase, Segment, etc. later.
  // For now, keep it non-breaking and console-based.
  const data = { name, ...payload, kind, ts: new Date().toISOString() };
  if (kind === "event") {
    console.debug("[telemetry:event]", data);
  } else {
    console.error("[telemetry:error]", data);
  }
}

export function trackEvent(name: string, payload: TelemetryPayload = {}): void {
  logEvent("event", name, payload);
}

export function trackError(error: unknown, context: TelemetryPayload = {}): void {
  const payload = { ...context, error: error instanceof Error ? error.message : String(error) };
  logEvent("error", "error", payload);
}

export function trackTierAccess(tier: string, feature: string): void {
  trackEvent("tier_access", { tier, feature });
}

export function trackAutopilotUsage(feature: string): void {
  trackEvent("autopilot_usage", { feature });
}
