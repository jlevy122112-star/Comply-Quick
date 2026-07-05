// Stripe metered-billing reporter.
//
// Reports accrued usage-based charges to Stripe using Billing Meter Events. Each
// meter maps to a Stripe meter `event_name` via env config; the reporter sends
// the accrued quantity for the customer and stamps `reported_to_stripe_at` so
// reporting is idempotent (one report per user/period/meter). Intended to run at
// period close (monthly cron) and safe to re-run — already-reported rows are
// skipped.
//
// Metered sources:
//   • api_usage_meters   — api_call ($0.01), api_template_upload ($50)
//   • billing_overages   — extra_scan ($5), the agency scan-overage ledger
//
// If STRIPE_SECRET_KEY or a meter's event-name env var is unset, that meter is
// skipped (the feature is inert until the user configures Stripe metered prices).

import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, logger } from "@/services";
import { currentPeriod } from "@/lib/billing/usage";

const log = logger.child({ module: "stripe-metered" });

/** Env var holding the Stripe meter `event_name` for each meter key. */
const METER_EVENT_ENV: Record<string, string> = {
  api_call: "STRIPE_METER_API_CALL",
  api_template_upload: "STRIPE_METER_TEMPLATE_UPLOAD",
  extra_scan: "STRIPE_METER_EXTRA_SCAN",
};

export interface ReportResult {
  period: string;
  reported: number;
  skipped: number;
}

function eventNameFor(meter: string): string | null {
  const envVar = METER_EVENT_ENV[meter];
  return (envVar && process.env[envVar]) || null;
}

/** Resolves the Stripe customer id for a user from their subscription row. */
async function customerIdFor(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<string | null> {
  const { data } = await admin.from("subscriptions").select("stripe_customer_id").eq("user_id", userId).maybeSingle();
  return data?.stripe_customer_id ?? null;
}

interface Reportable {
  table: "api_usage_meters" | "billing_overages";
  id: string;
  userId: string;
  meter: string;
  quantity: number;
}

/**
 * Reports all unreported metered usage for a period to Stripe. Returns how many
 * rows were reported vs. skipped (unconfigured meter, no customer, or Stripe not
 * configured). Never throws for an individual row — one bad row cannot block the
 * rest.
 */
export async function reportMeteredUsage(period: string = currentPeriod()): Promise<ReportResult> {
  const stripe = getStripe();
  if (!stripe) {
    log.warn("Stripe not configured; skipping metered usage reporting");
    return { period, reported: 0, skipped: 0 };
  }

  const admin = createAdminClient();
  const rows: Reportable[] = [];

  const { data: apiRows } = await admin
    .from("api_usage_meters")
    .select("id, user_id, meter, quantity")
    .eq("period", period)
    .is("reported_to_stripe_at", null);
  for (const r of apiRows ?? []) {
    rows.push({ table: "api_usage_meters", id: r.id, userId: r.user_id, meter: r.meter, quantity: r.quantity });
  }

  const { data: scanRows } = await admin
    .from("billing_overages")
    .select("id, user_id, scans_over")
    .eq("period", period)
    .gt("scans_over", 0)
    .is("reported_to_stripe_at", null);
  for (const r of scanRows ?? []) {
    rows.push({ table: "billing_overages", id: r.id, userId: r.user_id, meter: "extra_scan", quantity: r.scans_over });
  }

  let reported = 0;
  let skipped = 0;

  for (const row of rows) {
    const eventName = eventNameFor(row.meter);
    if (!eventName || row.quantity <= 0) {
      skipped += 1;
      continue;
    }
    try {
      const customerId = await customerIdFor(admin, row.userId);
      if (!customerId) {
        skipped += 1;
        continue;
      }
      await stripe.billing.meterEvents.create({
        event_name: eventName,
        payload: { stripe_customer_id: customerId, value: String(row.quantity) },
        identifier: `${row.table}:${row.id}:${period}`,
      });
      await admin.from(row.table).update({ reported_to_stripe_at: new Date().toISOString() }).eq("id", row.id);
      reported += 1;
    } catch (err) {
      log.error("Failed to report meter to Stripe", {
        meter: row.meter,
        message: err instanceof Error ? err.message : "unknown",
      });
      skipped += 1;
    }
  }

  log.info("Metered usage reporting complete", { period, reported, skipped });
  return { period, reported, skipped };
}
