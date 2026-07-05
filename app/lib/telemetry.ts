// app/lib/telemetry.ts

export type TelemetryPayload = Record<string, unknown>;

const TELEMETRY_ENABLED = true;

function log(kind: "event" | "error", name: string, payload: TelemetryPayload = {}) {
  if (!TELEMETRY_ENABLED) return;

  const data = {
    name,
    ...payload,
    kind,
    ts: new Date().toISOString(),
  };

  if (kind === "event") {
    console.debug("[telemetry:event]", data);
  } else {
    console.error("[telemetry:error]", data);
  }
}

export function trackEvent(name: string, payload: TelemetryPayload = {}) {
  log("event", name, payload);
}

export function trackError(error: unknown, context: TelemetryPayload = {}) {
  const payload = {
    ...context,
    error: error instanceof Error ? error.message : String(error),
  };
  log("error", "error", payload);
}

export function trackTierAccess(tier: string, feature: string) {
  trackEvent("tier_access", { tier, feature });
}

export function trackAutopilotUsage(feature: string) {
  trackEvent("autopilot_usage", { feature });
}
