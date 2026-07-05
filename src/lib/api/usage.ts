// Metered API usage tracking.
//
// Every authenticated API call is logged to api_usage_events (append-only audit)
// and rolled up into api_usage_meters per (user, period, meter) for idempotent
// Stripe reporting. Per-call prices come from TIER_CONFIG's METERED_PRICE_CENTS
// so API pricing never drifts from the pricing source of truth.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/entitlements";
import { currentPeriod } from "@/lib/billing/usage";
import { analytics, logger } from "@/services";
import { UnauthorizedError } from "@/services/errors";
import { METERED_PRICE_CENTS } from "@/lib/pricing";

const log = logger.child({ module: "api-usage" });

/** Metered event types billed on the API. */
export type ApiMeter = "api_call" | "api_template_upload";

/** Per-unit price in cents for a meter, from the pricing source of truth. */
export function meterCostCents(meter: ApiMeter): number {
  switch (meter) {
    case "api_call":
      return METERED_PRICE_CENTS.apiCall;
    case "api_template_upload":
      return METERED_PRICE_CENTS.apiTemplateUpload;
  }
}

export interface UsageLine {
  meter: string;
  quantity: number;
  costCents: number;
}

export interface ApiUsageSummary {
  period: string;
  lines: UsageLine[];
  totalCents: number;
}

/**
 * Records one metered API interaction: appends an audit event and atomically
 * increments the (user, period, meter) rollup. Called from the API-key layer
 * (no user session) so it uses the service-role client. Never throws — metering
 * must not break a successful API response.
 */
export async function recordApiUsage(params: {
  userId: string;
  apiKeyId: string | null;
  endpoint: string;
  meter: ApiMeter;
  quantity?: number;
  now?: Date;
}): Promise<void> {
  const quantity = params.quantity ?? 1;
  const period = currentPeriod(params.now);
  const costCents = meterCostCents(params.meter) * quantity;
  try {
    const admin = createAdminClient();
    await admin.from("api_usage_events").insert({
      user_id: params.userId,
      api_key_id: params.apiKeyId,
      period,
      endpoint: params.endpoint,
      meter: params.meter,
      quantity,
      cost_cents: costCents,
    });
    await admin.rpc("increment_api_usage", {
      p_user_id: params.userId,
      p_period: period,
      p_meter: params.meter,
      p_quantity: quantity,
      p_cost_cents: costCents,
    });
    analytics.track({
      event: "api_call_metered",
      userId: params.userId,
      properties: { meter: params.meter, quantity, costCents, endpoint: params.endpoint },
    });
  } catch (err) {
    log.error("Failed to record API usage", {
      message: err instanceof Error ? err.message : "unknown",
      meter: params.meter,
    });
  }
}

interface MeterRow {
  meter: string;
  quantity: number;
  cost_cents: number;
}

type UsageReader = Pick<ReturnType<typeof createAdminClient>, "from">;

/** Shared summary builder used by both the session and API-key entry points. */
async function buildUsageSummary(client: UsageReader, userId: string, now: Date): Promise<ApiUsageSummary> {
  const period = currentPeriod(now);
  const [meters, overage] = await Promise.all([
    client.from("api_usage_meters").select("meter, quantity, cost_cents").eq("user_id", userId).eq("period", period),
    client
      .from("billing_overages")
      .select("scans_over, overage_cents")
      .eq("user_id", userId)
      .eq("period", period)
      .maybeSingle(),
  ]);

  const lines: UsageLine[] = ((meters.data as MeterRow[] | null) ?? []).map((r) => ({
    meter: r.meter,
    quantity: r.quantity,
    costCents: r.cost_cents,
  }));

  const over = overage.data?.scans_over ?? 0;
  if (over > 0) {
    lines.push({ meter: "extra_scan", quantity: over, costCents: overage.data?.overage_cents ?? 0 });
  }

  const totalCents = lines.reduce((sum, l) => sum + l.costCents, 0);
  return { period, lines, totalCents };
}

/**
 * Usage summary for the signed-in user in a calendar month, combining the API
 * meters (calls, template uploads) with the scan-overage ledger so the usage
 * dashboard shows every metered charge in one place.
 */
export async function getApiUsageSummary(now: Date = new Date()): Promise<ApiUsageSummary> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  return buildUsageSummary(supabase, user.id, now);
}

/** Usage summary for an explicit user id (metered API context; no session). */
export async function getApiUsageSummaryForUser(userId: string, now: Date = new Date()): Promise<ApiUsageSummary> {
  return buildUsageSummary(createAdminClient(), userId, now);
}

/** Whether a tier may use the programmatic API (paid tiers only). */
export async function hasApiAccess(): Promise<boolean> {
  const { isPremium } = await getEntitlement();
  return isPremium;
}
