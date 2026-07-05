// Analytics event tracking for the Compliance OS.
//
// A thin, provider-agnostic layer so funnel/retention events are emitted from a
// single place. Today it writes structured log lines (picked up by the logger
// sink); a real destination (PostHog, Segment, Amplitude) can be wired in the
// `emit` method without touching call sites.
//
// Event names are enumerated so the funnel taxonomy stays stable across the
// freemium, checkout, and retention surfaces.

import { logger } from "./logger";

const log = logger.child({ module: "analytics" });

export type AnalyticsEvent =
  // Acquisition / funnel
  | "signup"
  | "scan_run"
  | "scan_limit_reached"
  | "paywall_viewed"
  | "upgrade_cta_clicked"
  // Checkout / revenue
  | "checkout_started"
  | "checkout_completed"
  | "subscription_canceled"
  // Expansion / usage
  | "api_call_metered"
  | "extra_scan_metered"
  // Retention
  | "nps_submitted";

export interface AnalyticsProperties {
  [key: string]: string | number | boolean | null | undefined;
}

export interface TrackParams {
  event: AnalyticsEvent;
  /** Distinct user id when known (Supabase user id). */
  userId?: string;
  /** Acquisition channel for retention segmentation (organic/ads/affiliate). */
  channel?: string;
  properties?: AnalyticsProperties;
}

class Analytics {
  /** Records a single analytics event. Never throws — analytics must not break flows. */
  track(params: TrackParams): void {
    try {
      this.emit(params);
    } catch (err) {
      log.error("Failed to record analytics event", {
        event: params.event,
        message: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  private emit(params: TrackParams): void {
    log.info("analytics_event", {
      event: params.event,
      userId: params.userId,
      channel: params.channel,
      ...params.properties,
    });
  }
}

export const analytics = new Analytics();
