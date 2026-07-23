// Compliance Scanner server service (Phase 3).
//
// DB-touching glue between the pure scan pipeline and Supabase. All reads/writes
// go through the RLS-scoped server client (a user only ever sees their own
// scans). Enforces a monthly free-tier quota; Agency and Enterprise are unlimited.

import * as Sentry from "@sentry/nextjs";
import { getActiveOrganizationId, organizationReadFilter } from "@/lib/organizations-db";
import { createClient } from "@/lib/supabase/server";
import { getOrgEntitlement } from "@/lib/entitlements";
import { getAiClient } from "@/services/ai";
import { analytics, logger } from "@/services";
import { UnauthorizedError } from "@/services/errors";
import { recordScanUsage, currentPeriod, periodStartIso } from "@/lib/billing/usage";
import { scanLimit } from "@/lib/pricing";
import { runScan } from "./pipeline";
import { materializeScanFindings } from "@/lib/findings-db";
import { normalizeScanUrl } from "./crawler";
import type { DetectedTool, Finding } from "./analyzer";
import { randomBytes } from "node:crypto";
import { createSystemAuditLog } from "@/lib/audit";

const log = logger.child({ module: "scanner" });

const SCAN_COLUMNS =
  "id, url, status, score, detected_tools, findings, summary, error, organization_id, client_id, shared_token, shared_at, emailed_at, created_at";

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
  organizationId: string | null;
  clientId: string | null;
  sharedToken: string | null;
  sharedAt: string | null;
  emailedAt: string | null;
  createdAt: string;
}

export interface ScanQuota {
  isPremium: boolean;
  used: number;
  limit: number | null; // null = unlimited
  remaining: number | null;
}

/** Reports the current account's scan quota for the current calendar month. */
export async function getScanQuota(): Promise<ScanQuota> {
  const entitlement = await getOrgEntitlement();
  const tier = entitlement.tier ?? (entitlement.isPremium ? "agency" : "free");
  const limit = scanLimit(tier);
  if (limit === Infinity) {
    return { isPremium: entitlement.isPremium, used: 0, limit: null, remaining: null };
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
  const remaining = limit === null ? null : Math.max(0, limit - used);
  return { isPremium: entitlement.isPremium, used, limit, remaining };
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
    organizationId: (row.organization_id as string | null) ?? null,
    clientId: (row.client_id as string | null) ?? null,
    sharedToken: (row.shared_token as string | null) ?? null,
    sharedAt: (row.shared_at as string | null) ?? null,
    emailedAt: (row.emailed_at as string | null) ?? null,
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
  normalizedUrl: string,
  organizationId: string | null
): Promise<ScanRecord | null> {
  const since = new Date(Date.now() - SCAN_CACHE_TTL_DAYS * 86_400_000).toISOString();
  const { data } = await supabase
    .from("scans")
    .select(SCAN_COLUMNS)
    .or(organizationReadFilter(userId, organizationId))
    .eq("url", normalizedUrl)
    .eq("status", "completed")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapRow(data) : null;
}

/** Lists scans linked to one project (most recent first). RLS-scoped. */
export async function listProjectScans(projectId: string, limit = 50): Promise<ScanRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();

  const { data, error } = await supabase
    .from("scans")
    .select(SCAN_COLUMNS)
    .or(organizationReadFilter(user.id, organizationId))
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map(mapRow);
}

/** Lists the current user's scan history (most recent first). */
export async function listScans(limit = 50): Promise<ScanRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();

  const { data, error } = await supabase
    .from("scans")
    .select(SCAN_COLUMNS)
    .or(organizationReadFilter(user.id, organizationId))
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
  const organizationId = await getActiveOrganizationId();

  const { data, error } = await supabase
    .from("scans")
    .select(SCAN_COLUMNS)
    .eq("id", id)
    .or(organizationReadFilter(user.id, organizationId))
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export class QuotaExceededError extends Error {
  constructor() {
    super("Free plan scan limit reached. Upgrade for more scans.");
    this.name = "QuotaExceededError";
  }
}

/**
 * Runs a scan for the current user, enforcing the free-tier quota, and persists
 * the result. Returns the stored record. Throws QuotaExceededError when a free
 * user is over budget and UnauthorizedError when signed out.
 */
export async function createScan(
  url: string,
  opts: { force?: boolean; projectId?: string | null; ipAddress?: string } = {}
): Promise<ScanRecord> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  const organizationId = await getActiveOrganizationId();
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
      const cached = await findRecentScan(supabase, user.id, normalizedUrl, organizationId);
      if (cached) {
        analytics.track({ event: "scan_cache_hit", userId: user.id, properties: { url: normalizedUrl } });
        return cached;
      }
    }
  }

  const quota = await getScanQuota();
  if (quota.remaining !== null && quota.remaining <= 0) {
    analytics.track({
      event: "scan_limit_reached",
      userId: user.id,
      properties: { used: quota.used, limit: quota.limit ?? 0 },
    });
    await createSystemAuditLog({
      eventType: "SCAN_QUOTA_EXCEEDED",
      actorType: "USER",
      actorId: user.id,
      organizationId,
      targetResource: `scans/${url}`,
      ipAddress: opts.ipAddress,
      details: { used: quota.used, limit: quota.limit, url },
    });
    throw new QuotaExceededError();
  }

  let outcome;
  try {
    outcome = await runScan({ url, ai: getAiClient() });
  } catch (err) {
    await createSystemAuditLog({
      eventType: "SCAN_FAILED",
      actorType: "USER",
      actorId: user.id,
      organizationId,
      targetResource: `scans/${url}`,
      ipAddress: opts.ipAddress,
      details: {
        reason: err instanceof Error ? err.message : String(err),
        url,
      },
    });
    throw err;
  }

  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      url: outcome.url,
      status: "completed",
      score: outcome.score,
      detected_tools: outcome.detectedTools,
      findings: outcome.findings,
      summary: outcome.summary,
      ...(opts.projectId ? { project_id: opts.projectId } : {}),
    })
    .select(SCAN_COLUMNS)
    .single();

  if (error || !data) {
    log.error("Failed to persist scan", { error: error?.message });
    await createSystemAuditLog({
      eventType: "SCAN_FAILED",
      actorType: "USER",
      actorId: user.id,
      organizationId,
      targetResource: "scans/pending",
      ipAddress: opts.ipAddress,
      details: {
        reason: error?.message ?? "Persistence failed",
        url: outcome.url,
      },
    });
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
      organizationId: null,
      clientId: null,
      sharedToken: null,
      sharedAt: null,
      emailedAt: null,
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

  await createSystemAuditLog({
    eventType: "SCAN_COMPLETED",
    actorType: "USER",
    actorId: user.id,
    organizationId,
    targetResource: `scans/${data.id as string}`,
    ipAddress: opts.ipAddress,
    details: {
      url: outcome.url,
      score: outcome.score,
      toolsCount: outcome.detectedTools.length,
      findingsCount: outcome.findings.length,
    },
  });

  // Promote this scan's findings into first-class, trackable rows (scan-first:
  // works even when the user has no project). Best-effort — never fail the scan.
  try {
    await materializeScanFindings(data.id as string, outcome.url, outcome.findings, opts.projectId ?? null);
  } catch (err) {
    // Never fail the scan on findings bookkeeping, but surface it to error
    // tracking so a broken table/migration doesn't silently drop findings.
    log.error("Failed to materialize scan findings", { error: err instanceof Error ? err.message : String(err) });
    Sentry.captureException(err);
  }

  log.info("Scan completed", { userId: user.id, score: outcome.score, tools: outcome.detectedTools.length });
  return mapRow(data);
}

function makeShareToken(): string {
  return `scan_${randomBytes(16).toString("hex")}`;
}

export async function getScanBySharedToken(token: string): Promise<ScanRecord | null> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin.from("scans").select(SCAN_COLUMNS).eq("shared_token", token).maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

export async function shareScan(
  id: string,
  clientId?: string | null,
  opts: { ipAddress?: string; log?: boolean } = {}
): Promise<{ ok: true; token: string; url: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const token = makeShareToken();
  const { data, error } = await supabase
    .from("scans")
    .update({ shared_token: token, shared_at: new Date().toISOString(), client_id: clientId ?? null })
    .eq("id", id)
    .eq("user_id", user.id)
    .select(SCAN_COLUMNS)
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not share scan" };

  if (opts.log !== false) {
    await createSystemAuditLog({
      eventType: "SCAN_SHARED",
      actorType: "USER",
      actorId: user.id,
      organizationId: (data.organization_id as string | null) ?? null,
      targetResource: `scans/${id}`,
      ipAddress: opts.ipAddress,
      details: {
        clientId: clientId ?? null,
        url: data.url as string,
        token,
      },
    });
  }

  const host = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return { ok: true, token, url: `${host}/share/scans/${token}` };
}

export async function unshareScan(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in required." };

  const { error } = await supabase
    .from("scans")
    .update({ shared_token: null, shared_at: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function markScanEmailed(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("scans").update({ emailed_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id);
}
