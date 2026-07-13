export const CANONICAL_EVENTS = {
  // Acquisition / activation
  signup: { client: false, stage: "activation", module: "auth" },
  scan_run: { client: false, stage: "activation", module: "scanner" },
  scan_limit_reached: { client: false, stage: "activation", module: "scanner" },
  paywall_viewed: { client: true, stage: "activation", module: "pricing" },
  upgrade_cta_clicked: { client: true, stage: "activation", module: "pricing" },
  pricing_variant_seen: { client: true, stage: "activation", module: "pricing" },

  // Revenue / lifecycle
  checkout_started: { client: false, stage: "expansion", module: "billing" },
  checkout_completed: { client: false, stage: "expansion", module: "billing" },
  subscription_canceled: { client: false, stage: "retention", module: "billing" },
  dunning_payment_failed: { client: false, stage: "retention", module: "billing" },
  dunning_payment_recovered: { client: false, stage: "retention", module: "billing" },

  // Product expansion usage
  api_call_metered: { client: false, stage: "expansion", module: "api" },
  extra_scan_metered: { client: false, stage: "expansion", module: "scanner" },
  scan_cache_hit: { client: false, stage: "retention", module: "scanner" },
  expansion_nudge_shown: { client: true, stage: "expansion", module: "command_center" },
  expansion_nudge_clicked: { client: true, stage: "expansion", module: "command_center" },

  // PMF / advocacy
  nps_submitted: { client: false, stage: "advocacy", module: "pmf" },
  churn_save_offer_shown: { client: true, stage: "retention", module: "cancel_flow" },
  churn_save_offer_accepted: { client: true, stage: "retention", module: "cancel_flow" },

  // Performance telemetry
  web_vital_reported: { client: true, stage: "activation", module: "performance" },
  web_vital_budget_failed: { client: true, stage: "retention", module: "performance" },
} as const;

export type AnalyticsEvent = keyof typeof CANONICAL_EVENTS;
export type ClientAnalyticsEvent = {
  [K in AnalyticsEvent]: (typeof CANONICAL_EVENTS)[K]["client"] extends true ? K : never;
}[AnalyticsEvent];

export const CLIENT_EMITTABLE_EVENTS = Object.entries(CANONICAL_EVENTS)
  .filter(([, meta]) => meta.client)
  .map(([event]) => event) as ClientAnalyticsEvent[];

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && value in CANONICAL_EVENTS;
}
