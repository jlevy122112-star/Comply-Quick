// Compliance Intelligence server service (Phase 4).
//
// DB-touching glue between the pure risk engine / fix recommender and Supabase.
// User-facing reads/writes go through the RLS-scoped server client; the weekly
// cron uses the service-role admin client to fan out across premium users.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/entitlements";
import { getAiClient, type AiClient } from "@/services/ai";
import { logger } from "@/services";
import { UnauthorizedError } from "@/services/errors";
import { runScan } from "@/lib/scanner/pipeline";
import type { DetectedTool, Finding } from "@/lib/scanner/analyzer";
import { detectRisks, type ScanSnapshot } from "./risk";
import { buildFixRecommendation } from "./pipeline";

const log = logger.child({ module: "intelligence" });

/** Re-scan cadence in days (weekly). A monitor is "due" once this has elapsed. */
export const RESCAN_INTERVAL_DAYS = 7;

export interface MonitorRecord {
  id: string;
  url: string;
  label: string;
  active: boolean;
  lastScannedAt: string | null;
  lastScore: number | null;
  createdAt: string;
}

export interface AlertRecord {
  id: string;
  monitorId: string | null;
  scanId: string | null;
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  detail: Record<string, unknown>;
  fixRecommendation: string | null;
  read: boolean;
  resolved: boolean;
  createdAt: string;
}

/** Whether the current user may use proactive monitoring (Pro-tier gate). */
export async function canUseIntelligence(): Promise<boolean> {
  const entitlement = await getEntitlement();
  return entitlement.isPremium;
}

function mapMonitor(row: Record<string, unknown>): MonitorRecord {
  return {
    id: row.id as string,
    url: row.url as string,
    label: (row.label as string) ?? "",
    active: Boolean(row.active),
    lastScannedAt: (row.last_scanned_at as string | null) ?? null,
    lastScore: (row.last_score as number | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function mapAlert(row: Record<string, unknown>): AlertRecord {
  return {
    id: row.id as string,
    monitorId: (row.monitor_id as string | null) ?? null,
    scanId: (row.scan_id as string | null) ?? null,
    type: row.type as string,
    severity: row.severity as AlertRecord["severity"],
    title: row.title as string,
    body: (row.body as string) ?? "",
    detail: (row.detail as Record<string, unknown>) ?? {},
    fixRecommendation: (row.fix_recommendation as string | null) ?? null,
    read: Boolean(row.read),
    resolved: Boolean(row.resolved),
    createdAt: row.created_at as string,
  };
}

// ─── Monitors (user-facing) ──────────────────────────────────────────────────

export async function listMonitors(): Promise<MonitorRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("scan_monitors")
    .select("id, url, label, active, last_scanned_at, last_score, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapMonitor);
}

export class MonitorLimitError extends Error {
  constructor() {
    super("Monitoring is a Pro-tier feature. Upgrade to watch sites over time.");
    this.name = "MonitorLimitError";
  }
}

/** Registers a URL for weekly monitoring. Pro-gated. */
export async function createMonitor(url: string, label = ""): Promise<MonitorRecord> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();
  if (!(await canUseIntelligence())) throw new MonitorLimitError();

  const { data, error } = await supabase
    .from("scan_monitors")
    .upsert(
      { user_id: user.id, url: url.trim(), label: label.trim(), active: true, updated_at: new Date().toISOString() },
      { onConflict: "user_id,url" }
    )
    .select("id, url, label, active, last_scanned_at, last_score, created_at")
    .single();
  if (error || !data) {
    log.error("Failed to create monitor", { error: error?.message });
    throw new Error("Could not create monitor.");
  }
  return mapMonitor(data);
}

export async function deleteMonitor(id: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("scan_monitors").delete().eq("id", id).eq("user_id", user.id);
  return !error;
}

// ─── Alerts (user-facing) ────────────────────────────────────────────────────

export async function listAlerts(includeResolved = false): Promise<AlertRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("compliance_alerts")
    .select(
      "id, monitor_id, scan_id, type, severity, title, body, detail, fix_recommendation, read, resolved, created_at"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (!includeResolved) query = query.eq("resolved", false);

  const { data, error } = await query;
  if (error || !data) return [];
  return data.map(mapAlert);
}

export async function markAlertRead(id: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("compliance_alerts").update({ read: true }).eq("id", id).eq("user_id", user.id);
  return !error;
}

export async function resolveAlert(id: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase
    .from("compliance_alerts")
    .update({ resolved: true, read: true })
    .eq("id", id)
    .eq("user_id", user.id);
  return !error;
}

/**
 * Returns a remediation plan for an alert, generating and caching it on first
 * request. RLS ensures the alert belongs to the caller.
 */
export async function getAlertFix(id: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data: alert, error } = await supabase
    .from("compliance_alerts")
    .select("id, type, title, body, detail, fix_recommendation, monitor_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !alert) return null;
  if (alert.fix_recommendation) return alert.fix_recommendation as string;

  // Resolve the monitored URL for richer context (best-effort).
  let url = "";
  if (alert.monitor_id) {
    const { data: monitor } = await supabase
      .from("scan_monitors")
      .select("url")
      .eq("id", alert.monitor_id as string)
      .maybeSingle();
    url = (monitor?.url as string) ?? "";
  }

  const recommendation = await buildFixRecommendation(
    {
      url,
      type: alert.type as FixType,
      title: alert.title as string,
      body: (alert.body as string) ?? "",
      detail: (alert.detail as Record<string, unknown>) ?? {},
    },
    getAiClient()
  );

  await supabase
    .from("compliance_alerts")
    .update({ fix_recommendation: recommendation })
    .eq("id", id)
    .eq("user_id", user.id);
  return recommendation;
}

type FixType = "score_drop" | "new_tracker" | "new_critical" | "scan_failed" | "info";

// ─── Weekly cron run (service role) ──────────────────────────────────────────

export interface IntelligenceRunResult {
  monitorsScanned: number;
  alertsRaised: number;
}

interface MonitorAdminRow {
  id: string;
  user_id: string;
  url: string;
  last_scan_id: string | null;
}

/**
 * Weekly intelligence pass (invoked by the scheduled Edge Function). Re-scans
 * every active, due monitor owned by a premium user, compares against the prior
 * scan, raises alerts on increased risk, and stamps the monitor. Non-premium
 * owners are skipped (monitoring is a Pro feature).
 */
export async function runIntelligence(ai: AiClient = getAiClient()): Promise<IntelligenceRunResult> {
  const admin = createAdminClient();
  let monitorsScanned = 0;
  let alertsRaised = 0;

  const { data: premium } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("status", "active")
    .neq("tier", "free");
  const premiumUserIds = new Set((premium ?? []).map((r) => r.user_id as string));
  if (premiumUserIds.size === 0) return { monitorsScanned: 0, alertsRaised: 0 };

  const dueBefore = new Date(Date.now() - RESCAN_INTERVAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: monitors } = await admin
    .from("scan_monitors")
    .select("id, user_id, url, last_scan_id")
    .eq("active", true)
    .or(`last_scanned_at.is.null,last_scanned_at.lt.${dueBefore}`);

  for (const monitor of (monitors ?? []) as MonitorAdminRow[]) {
    if (!premiumUserIds.has(monitor.user_id)) continue;

    // Previous snapshot (for diffing) from the monitor's last scan.
    let previous: ScanSnapshot | null = null;
    if (monitor.last_scan_id) {
      const { data: prev } = await admin
        .from("scans")
        .select("score, detected_tools, findings")
        .eq("id", monitor.last_scan_id)
        .maybeSingle();
      if (prev) {
        previous = {
          score: (prev.score as number | null) ?? null,
          detectedTools: (prev.detected_tools as DetectedTool[]) ?? [],
          findings: (prev.findings as Finding[]) ?? [],
        };
      }
    }

    const now = new Date().toISOString();
    try {
      const outcome = await runScan({ url: monitor.url, ai });
      monitorsScanned += 1;

      const { data: scanRow } = await admin
        .from("scans")
        .insert({
          user_id: monitor.user_id,
          monitor_id: monitor.id,
          url: outcome.url,
          status: "completed",
          score: outcome.score,
          detected_tools: outcome.detectedTools,
          findings: outcome.findings,
          summary: outcome.summary,
        })
        .select("id")
        .single();
      const scanId = scanRow?.id ?? null;

      const risks = detectRisks(previous, {
        score: outcome.score,
        detectedTools: outcome.detectedTools,
        findings: outcome.findings,
      });

      for (const risk of risks) {
        await admin.from("compliance_alerts").insert({
          user_id: monitor.user_id,
          monitor_id: monitor.id,
          scan_id: scanId,
          type: risk.type,
          severity: risk.severity,
          title: risk.title,
          body: risk.body,
          detail: risk.detail,
        });
        await admin.from("notifications").insert({
          user_id: monitor.user_id,
          type: "action_needed",
          title: `Compliance alert — ${monitor.url}`,
          body: risk.title,
        });
        alertsRaised += 1;
      }

      await admin
        .from("scan_monitors")
        .update({ last_scanned_at: now, last_scan_id: scanId, last_score: outcome.score, updated_at: now })
        .eq("id", monitor.id);
    } catch (err) {
      // A failed scan is itself an alert-worthy event.
      await admin.from("compliance_alerts").insert({
        user_id: monitor.user_id,
        monitor_id: monitor.id,
        type: "scan_failed",
        severity: "warning",
        title: `Scan failed for ${monitor.url}`,
        body: err instanceof Error ? err.message : "The site could not be scanned on this run.",
        detail: {},
      });
      alertsRaised += 1;
      await admin.from("scan_monitors").update({ last_scanned_at: now, updated_at: now }).eq("id", monitor.id);
      log.warn("Monitor scan failed", {
        monitorId: monitor.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info("Intelligence run complete", { monitorsScanned, alertsRaised, aiClient: ai.id });
  return { monitorsScanned, alertsRaised };
}
