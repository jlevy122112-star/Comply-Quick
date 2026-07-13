import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { analytics, errorResponse, logger, ValidationError, type AnalyticsEvent } from "@/services";

// Client-emitted events. Billing-critical events remain server-only so they
// cannot be spoofed by a browser request.
const CLIENT_EVENTS: readonly AnalyticsEvent[] = [
  "paywall_viewed",
  "upgrade_cta_clicked",
  "pricing_variant_seen",
  "expansion_nudge_shown",
  "expansion_nudge_clicked",
  "churn_save_offer_shown",
  "churn_save_offer_accepted",
  "web_vital_reported",
  "web_vital_budget_failed",
];

function isClientEvent(value: unknown): value is AnalyticsEvent {
  return typeof value === "string" && (CLIENT_EVENTS as readonly string[]).includes(value);
}

/** Records a browser-side funnel event, attributed to the signed-in user when present. */
export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new ValidationError("Invalid JSON body.");
    }

    const event = (body as { event?: unknown } | null)?.event;
    if (!isClientEvent(event)) throw new ValidationError("Unsupported analytics event.");

    const rawProps = (body as { properties?: unknown }).properties;
    const properties =
      rawProps && typeof rawProps === "object" && !Array.isArray(rawProps)
        ? (rawProps as Record<string, string | number | boolean | null>)
        : undefined;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    analytics.track({ event, userId: user?.id, properties });
    if (event === "web_vital_budget_failed") {
      logger.child({ module: "web-vitals-alert" }).warn("Core Web Vitals budget failed", {
        userId: user?.id,
        metric: properties?.metric,
        route: properties?.route,
        value: properties?.value,
      });
      Sentry.captureMessage("Core Web Vitals budget failed", {
        level: "warning",
        tags: {
          module: "web-vitals-alert",
          metric: typeof properties?.metric === "string" ? properties.metric : "unknown",
          route: typeof properties?.route === "string" ? properties.route : "unknown",
        },
      });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
