// Compliance Scanner server service (Phase 3).
//
// DB-touching glue between the pure scan pipeline and Supabase. All reads/writes
// go through the RLS-scoped server client (a user only ever sees their own
// scans). Enforces a monthly free-tier quota; Pro tiers are unlimited.

import * as Sentry from "@sentry/nextjs";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { getAiClient } from "@/services/ai";
import { analytics, logger } from "@/services";
import { UnauthorizedError } from "@/services/errors";
import { recordScanUsage, currentPeriod, periodStartIso } from "@/lib/billing/usage";
import { scanLimit } from "@/lib/pricing";
import { runScan } from "./pipeline";
import { normalizeScanUrl } from "./crawler";
import type { DetectedTool, Finding } from "./analyzer";

const log = logger.child({ module: "scanner" });

/**
 * Scan-cache window. A completed scan of the same (normalized) URL within this
 * many days is reused instead of re-crawling — cuts scanner/AI cost and never
 * counts against the free-tier quota. Cost optimization per BUILD_PLAN §9.
 */
export const SCAN_CACHE_TTL_DAYS = 7;

/**
 * Free-tier scan allotment per calendar month. Sourced from TIER_CONFIG (the
 * pricing source of truth) so the freemium cap never drifts from the plan.
 */
export const FREE_SCAN_QUOTA = scanLimit("free");

export interface ScanRecord {
  id: string;
  url: string;
  status: "completed" | "failed";
  score: number | null;
  detectedTools: DetectedTool[];
  findings: Finding[];
  summary: string;
  error: string | null;
  createdAt: string;
}

export interface ScanQuota {
  isPremium: boolean;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
}

/** Reports the current user's scan quota for the current calendar month. */
export async function getScanQuota(): Promise<ScanQuota> {
  const entitlement = await getEntitlement();
  if (entitlement.isPremium) {
    return { isPremium: true, used: 0, limit: null, remaining: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { count } = await supabase
    .from("scans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", periodStartIso(currentPeriod()));

  const used = count ?? 0;
  return { isPremium: false, used, limit: FREE_SCAN_QUOTA, remaining: Math.max(0, FREE_SCAN_QUOTA - used) };
}

function mapRow(row: Record<string, unknown>): ScanRecord {
  return {
    id: row.id as string,
    url: row.url as string,
    status: row.status as ScanRecord["status"],
    score: (row.score as number | null) ?? null,
    detectedTools: (row.detected_tools as DetectedTool[]) ?? [],
    findings: (row.findings as Finding[]) ?? [],
    summary: (row.summary as string) ?? "",
    error: (row.error as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/**
 * Returns a recent completed scan of the same normalized URL for this user,
 * within the cache window, or null. Used to skip a re-crawl (and the quota
 * charge) for repeat scans of the same site.
 */
async function findRecentScan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  normalizedUrl: string
): Promise<ScanRecord | null> {
  const since = new Date(Date.now() - SCAN_CACHE_TTL_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("scans")
    .select("id, url, status, score, detected_tools, findings, summary, error, created_at")
    .eq("user_id", userId)
    .eq("url", normalizedUrl)
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRow(data) : null;
}

/** Lists the current user's scan history (most recent first). */
export async function listScans(limit = 50): Promise<ScanRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("scans")
    .select("id, url, status, score, detected_tools, findings, summary, error, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(mapRow);
}

export async function getScan(id: string): Promise<ScanRecord | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("scans")
    .select("id, url, status, score, detected_tools, findings, summary, error, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export class QuotaExceededError extends Error {
  constructor() {
    super("Free plan scan limit reached. Upgrade for unlimited scans.");
    this.name = "QuotaExceededError";
  }
}

/**
 * Runs a scan for the current user, enforcing the free-tier quota, and persists
 * the result. Returns the stored record. Throws QuotaExceededError when a free
 * user is over budget and UnauthorizedError when signed out.
 */
export async function createScan(url: string, opts: { force?: boolean } = {}): Promise<ScanRecord> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  // Attribute the AI monitoring trace to this subscriber (id only, no PII).
  Sentry.setUser({ id: user.id });

  // Reuse a recent scan of the same URL (skips the crawl + quota charge). The
  // normalized URL matches what the pipeline persists (page.url). Never throws.
  if (!opts.force) {
    let normalizedUrl: string | null = null;
    try {
      normalizedUrl = normalizeScanUrl(url).toString();
    } catch {
      normalizedUrl = null;
    }
    if (normalizedUrl) {
      const cached = await findRecentScan(supabase, user.id, normalizedUrl);
      if (cached) {
        analytics.track({ event: "scan_cache_hit", userId: user.id, properties: { url: normalizedUrl } });
        return cached;
      }
    }
  }

  const quota = await getScanQuota();
  if (!quota.isPremium && quota.remaining !== null && quota.remaining <= 0) {
    analytics.track({
      event: "scan_limit_reached",
      userId: user.id,
      properties: { used: quota.used, limit: quota.limit ?? 0 },
    });
    throw new QuotaExceededError();
  }

  const outcome = await runScan({ url, ai: getAiClient() });

  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: user.id,
      url: outcome.url,
      status: "completed",
      score: outcome.score,
      detected_tools: outcome.detectedTools,
      findings: outcome.findings,
      summary: outcome.summary,
    })
    .select("id, url, status, score, detected_tools, findings, summary, error, created_at")
    .single();

  if (error || !data) {
    log.error("Failed to persist scan", { error: error?.message });
    // Return the outcome even if persistence failed so the user still sees it.
    return {
      id: "",
      url: outcome.url,
      status: "completed",
      score: outcome.score,
      detectedTools: outcome.detectedTools,
      findings: outcome.findings,
      summary: outcome.summary,
      error: null,
      createdAt: new Date().toISOString(),
    };
  }

  // Accrue metered overage when this scan pushes the account past its monthly
  // included allotment (Agency); unlimited/within-plan tiers are no-ops.
  await recordScanUsage();

  analytics.track({
    event: "scan_run",
    userId: user.id,
    properties: { score: outcome.score ?? 0, tools: outcome.detectedTools.length },
  });

  log.info("Scan completed", { userId: user.id, score: outcome.score, tools: outcome.detectedTools.length });
  return mapRow(data);
}
