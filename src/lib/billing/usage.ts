// Agency billing: seat usage, scan usage, and metered overage accrual.
//
// Limits come from TIER_CONFIG (the pricing source of truth) so seats/scans
// never drift from what a plan advertises. Usage is computed live from the
// existing rows (agency_members for seats, scans for the calendar month) — no
// duplicate counters to keep in sync — while overage is persisted to the
// billing_overages ledger so it can be reported to Stripe idempotently.

import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { getOrCreateAgency } from "@/lib/agency/service";
import { analytics, logger } from "@/services";
import { UnauthorizedError } from "@/services/errors";
import { TIER_CONFIG, METERED_PRICE_CENTS, isUnlimited, type Tier } from "@/lib/pricing";

const log = logger.child({ module: "billing" });

export interface SeatUsage {
  used: number;
  /** Included seats. `Infinity` = unlimited (Enterprise). */
  limit: number;
  remaining: number;
}

export interface ScanUsage {
  /** Calendar-month bucket, e.g. "2026-07". */
  period: string;
  used: number;
  /** Included scans this month. `Infinity` = unlimited. */
  limit: number;
  /** Scans run beyond the included allotment (0 when within plan / unlimited). */
  over: number;
  /** Accrued overage in cents (over × per-scan overage rate). */
  overageCents: number;
}

export interface BillingSummary {
  tier: Tier;
  seats: SeatUsage;
  scans: ScanUsage;
}

/** Current calendar-month bucket in UTC, e.g. "2026-07". */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Previous calendar-month bucket in UTC, e.g. "2026-06" when now is July. */
export function previousPeriod(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return currentPeriod(d);
}

/** UTC start-of-month ISO timestamp for the given period bucket. */
export function periodStartIso(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toISOString();
}

/**
 * Overage for `used` scans against an included `limit`. Unlimited plans and
 * within-plan usage return zero; otherwise each extra scan costs the metered
 * extra-scan rate.
 */
export function computeOverage(used: number, limit: number): { over: number; overageCents: number } {
  const over = isUnlimited(limit) ? 0 : Math.max(0, used - limit);
  return { over, overageCents: over * METERED_PRICE_CENTS.extraScan };
}

/**
 * Seat usage for the caller's agency: how many member seats are filled versus
 * the tier's included seats. Enterprise is unlimited.
 */
export async function getSeatUsage(): Promise<SeatUsage> {
  const entitlement = await getEntitlement();
  const limit = TIER_CONFIG[entitlement.tier].seats;

  const agency = await getOrCreateAgency();
  const supabase = await createClient();
  const { count } = await supabase
    .from("agency_members")
    .select("id", { count: "exact", head: true })
    .eq("agency_id", agency.id);

  const used = count ?? 0;
  return { used, limit, remaining: isUnlimited(limit) ? Infinity : Math.max(0, limit - used) };
}

/** Whether the caller can add another member seat without exceeding the plan. */
export async function hasSeatAvailable(): Promise<boolean> {
  const { remaining } = await getSeatUsage();
  return remaining > 0;
}

/**
 * Scan usage for the caller in the current calendar month, including any accrued
 * overage. Overage only applies to metered tiers with a finite scanLimit
 * (Solo); Free caps are enforced separately by the scanner quota, and Agency +
 * Enterprise are unlimited.
 */
export async function getScanUsage(now: Date = new Date()): Promise<ScanUsage> {
  const entitlement = await getEntitlement();
  const limit = TIER_CONFIG[entitlement.tier].scanLimit;
  const period = currentPeriod(now);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { count } = await supabase
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", periodStartIso(period));

  const used = count ?? 0;
  const { over, overageCents } = computeOverage(used, limit);
  return { period, used, limit, over, overageCents };
}

/**
 * Records that a scan was run and, when it pushes the account past its included
 * monthly allotment, accrues metered overage into the ledger. Safe to call after
 * every scan: unlimited tiers and within-plan usage are no-ops for the ledger.
 * Never throws — billing accounting must not break the scan flow.
 */
export async function recordScanUsage(now: Date = new Date()): Promise<void> {
  try {
    const usage = await getScanUsage(now);
    if (isUnlimited(usage.limit)) return;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("billing_overages").upsert(
      {
        user_id: user.id,
        period: usage.period,
        scans_used: usage.used,
        scans_over: usage.over,
        overage_cents: usage.overageCents,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,period" }
    );

    if (usage.over > 0) {
      analytics.track({
        event: "extra_scan_metered",
        userId: user.id,
        properties: { period: usage.period, over: usage.over, overageCents: usage.overageCents },
      });
    }
  } catch (err) {
    log.error("Failed to record scan usage", { message: err instanceof Error ? err.message : "unknown" });
  }
}

/** Combined seat + scan usage for the agency billing panel. */
export async function getBillingSummary(): Promise<BillingSummary> {
  const entitlement = await getEntitlement();
  const [seats, scans] = await Promise.all([getSeatUsage(), getScanUsage()]);
  return { tier: entitlement.tier, seats, scans };
}
