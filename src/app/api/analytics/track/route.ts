import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analytics, errorResponse, ValidationError, type AnalyticsEvent } from "@/services";

// Client-emitted funnel events. Only these are accepted from the browser — all
// revenue/usage events are emitted server-side where they can't be spoofed.
const CLIENT_EVENTS: readonly AnalyticsEvent[] = ["paywall_viewed", "upgrade_cta_clicked"];

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
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
