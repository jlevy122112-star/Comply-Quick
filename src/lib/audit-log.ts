// Immutable audit trail — server data layer (framework §3.7 / A4).
//
// Append-only writes for consequential actions (approvals, publishes, exports).
// Writes are best-effort: a failure to log must never break the action being
// logged, so recordAuditLog swallows errors (and reports them to Sentry). Reads
// are RLS-scoped to the caller; the table has no update/delete policy, so the
// trail is tamper-evident by construction.

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, organizationReadFilter } from "@/lib/organizations-db";
import { logger } from "@/services";
import * as Sentry from "@sentry/nextjs";

const log = logger.child({ module: "audit-log" });

export interface AuditLogEntry {
  action: string;
  entityType?: string;
  entityId?: string | null;
  projectId?: string | null;
  summary?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  projectId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * Appends one audit-trail row for the current user. Best-effort: never throws,
 * so callers can log without wrapping in try/catch. Returns true on success.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<boolean> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const organizationId = await getActiveOrganizationId();
    const { error } = await supabase.from("audit_logs").insert({
      user_id: user.id,
      organization_id: organizationId,
      action: entry.action,
      entity_type: entry.entityType ?? "",
      entity_id: entry.entityId ?? null,
      project_id: entry.projectId ?? null,
      summary: entry.summary ?? "",
      metadata: entry.metadata ?? {},
    });
    if (error) {
      log.warn("Failed to write audit log", { action: entry.action, error: error.message });
      return false;
    }
    return true;
  } catch (err) {
    log.error("Audit log write threw", { error: err instanceof Error ? err.message : String(err) });
    Sentry.captureException(err);
    return false;
  }
}

/** Lists the caller's audit trail (newest first), optionally scoped to a project. */
export async function listAuditLogs(opts: { projectId?: string; limit?: number } = {}): Promise<AuditLogRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, project_id, summary, metadata, created_at")
    .or(organizationReadFilter(user.id, organizationId))
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);
  if (opts.projectId) query = query.eq("project_id", opts.projectId);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    action: r.action as string,
    entityType: (r.entity_type as string) ?? "",
    entityId: (r.entity_id as string | null) ?? null,
    projectId: (r.project_id as string | null) ?? null,
    summary: (r.summary as string) ?? "",
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
  }));
}
