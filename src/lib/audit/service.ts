import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/services";
import * as Sentry from "@sentry/nextjs";
import { createGzip } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = logger.child({ module: "system-audit" });

const ARCHIVE_BUCKET = "audit-logs";
const ARCHIVE_PREFIX = "logs";
const ARCHIVE_BATCH = 500;
const DELETE_BATCH = 1000;

export type AuditActorType = "USER" | "CRON_JOB" | "API_KEY" | "SYSTEM";

export interface CreateSystemAuditLogInput {
  eventType: string;
  actorId?: string | null;
  actorType: AuditActorType;
  targetResource?: string;
  ipAddress?: string;
  details?: Record<string, unknown>;
  organizationId?: string | null;
}

export interface SystemAuditLogRecord {
  id: string;
  createdAt: string;
  eventType: string;
  actorId: string | null;
  actorType: AuditActorType;
  targetResource: string | null;
  ipAddress: string | null;
  details: Record<string, unknown>;
  organizationId: string | null;
}

export interface ListSystemAuditLogsOptions {
  organizationId?: string | null;
  eventType?: string;
  actorId?: string;
  targetResource?: string;
  start?: string;
  end?: string;
  limit?: number;
  offset?: number;
}

export interface ArchiveResult {
  archivedCount: number;
  files: string[];
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Appends one immutable system-audit row. Best-effort: never throws, so callers
 * can log without wrapping in try/catch. Returns true on success.
 */
export async function createSystemAuditLog(input: CreateSystemAuditLogInput): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("system_audit_logs").insert({
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      actor_type: input.actorType,
      target_resource: input.targetResource ?? null,
      ip_address: input.ipAddress ?? null,
      details: input.details ?? {},
      organization_id: input.organizationId ?? null,
    });
    if (error) {
      log.warn("Failed to write system audit log", { eventType: input.eventType, error: error.message });
      return false;
    }
    return true;
  } catch (err) {
    log.error("System audit log write threw", { error: err instanceof Error ? err.message : String(err) });
    Sentry.captureException(err);
    return false;
  }
}

/** Lists active system audit logs (newest first), with optional filters. */
export async function listSystemAuditLogs(opts: ListSystemAuditLogsOptions = {}): Promise<SystemAuditLogRecord[]> {
  try {
    const admin = createAdminClient();
    let query = admin
      .from("system_audit_logs")
      .select(
        "id, created_at, event_type, actor_id, actor_type, target_resource, ip_address, details, organization_id"
      )
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 100)
      .offset(opts.offset ?? 0);

    if (opts.organizationId) query = query.eq("organization_id", opts.organizationId);
    if (opts.eventType) query = query.eq("event_type", opts.eventType);
    if (opts.actorId) query = query.eq("actor_id", opts.actorId);
    if (opts.targetResource) query = query.ilike("target_resource", `%${opts.targetResource}%`);
    if (opts.start) query = query.gte("created_at", opts.start);
    if (opts.end) query = query.lt("created_at", opts.end);

    const { data, error } = await query;
    if (error) {
      log.warn("Failed to list system audit logs", { error: error.message });
      return [];
    }
    return (data ?? []).map(mapRow);
  } catch (err) {
    log.error("listSystemAuditLogs threw", { error: err instanceof Error ? err.message : String(err) });
    Sentry.captureException(err);
    return [];
  }
}

/** Compresses and moves logs older than `olderThanDays` to encrypted storage, then removes them from the DB. */
export async function archiveSystemAuditLogs(olderThanDays = 90): Promise<ArchiveResult> {
  const admin = createAdminClient();
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);
  cutoff.setUTCHours(0, 0, 0, 0);
  const cutoffIso = cutoff.toISOString();

  const { data: bounds, error: boundsError } = await admin
    .from("system_audit_logs")
    .select("created_at")
    .lt("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();
  if (boundsError || !bounds) return { archivedCount: 0, files: [] };

  const oldest = new Date(bounds.created_at as string);
  const files: string[] = [];
  let archivedCount = 0;

  let monthCursor = startOfMonth(oldest);
  while (monthCursor < cutoff) {
    const monthStart = monthCursor.toISOString();
    const monthEnd = addMonths(monthCursor, 1);
    const archiveUntil = monthEnd < cutoff ? monthEnd : cutoff;
    const path = `${ARCHIVE_PREFIX}/${formatMonth(monthCursor)}-system-audit-logs.json.gz`;

    const count = await archiveMonth(admin, monthStart, archiveUntil.toISOString(), path);
    if (count > 0) {
      files.push(path);
      archivedCount += count;
    }
    monthCursor = monthEnd;
  }

  if (archivedCount > 0) {
    await createSystemAuditLog({
      eventType: "AUDIT_LOGS_ARCHIVED",
      actorType: "CRON_JOB",
      targetResource: "system_audit_logs/archive",
      details: { archivedCount, files, olderThanDays, cutoff: cutoffIso },
    });
  }

  return { archivedCount, files };
}

/** Lists compressed archive files available in storage. */
export async function getArchivedAuditLogFiles(
  limit = 100
): Promise<{ name: string; createdAt: string; size?: number }[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(ARCHIVE_BUCKET).list(ARCHIVE_PREFIX, {
      limit,
      sortBy: { column: "name", order: "desc" },
    });
    if (error) {
      log.warn("Failed to list audit log archives", { error: error.message });
      return [];
    }
    return (data ?? []).map((f: any) => ({
      name: f.name as string,
      createdAt: f.created_at as string,
      size: typeof f.metadata?.size === "number" ? f.metadata.size : undefined,
    }));
  } catch (err) {
    log.error("getArchivedAuditLogFiles threw", { error: err instanceof Error ? err.message : String(err) });
    Sentry.captureException(err);
    return [];
  }
}

function mapRow(row: any): SystemAuditLogRecord {
  return {
    id: row.id as string,
    createdAt: row.created_at as string,
    eventType: row.event_type as string,
    actorId: row.actor_id ?? null,
    actorType: row.actor_type as AuditActorType,
    targetResource: row.target_resource ?? null,
    ipAddress: row.ip_address ?? null,
    details: (row.details as Record<string, unknown>) ?? {},
    organizationId: row.organization_id ?? null,
  };
}

async function archiveMonth(
  admin: AdminClient,
  startIso: string,
  endIso: string,
  path: string
): Promise<number> {
  const { buffer, ids } = await compressMonth(admin, startIso, endIso);
  if (ids.length === 0) return 0;

  const { error: uploadError } = await admin.storage.from(ARCHIVE_BUCKET).upload(path, buffer, {
    contentType: "application/gzip",
    upsert: true,
    cacheControl: "31536000, immutable",
  });
  if (uploadError) throw uploadError;

  for (let i = 0; i < ids.length; i += DELETE_BATCH) {
    const batch = ids.slice(i, i + DELETE_BATCH);
    const { error: deleteError } = await admin.from("system_audit_logs").delete().in("id", batch);
    if (deleteError) throw deleteError;
  }

  return ids.length;
}

async function compressMonth(
  admin: AdminClient,
  startIso: string,
  endIso: string
): Promise<{ buffer: Buffer; ids: string[] }> {
  const ids: string[] = [];
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const gzip = createGzip({ level: 9 });
    const chunks: Buffer[] = [];
    gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
    gzip.on("error", reject);
    gzip.on("end", () => resolve(Buffer.concat(chunks)));

    (async () => {
      try {
        let lastId: string | null = null;
        while (true) {
          let query = admin
            .from("system_audit_logs")
            .select(
              "id, created_at, event_type, actor_id, actor_type, target_resource, ip_address, details, organization_id"
            )
            .gte("created_at", startIso)
            .lt("created_at", endIso)
            .order("id")
            .limit(ARCHIVE_BATCH);
          if (lastId) query = query.gt("id", lastId);
          const { data, error } = await query;
          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const row of data) {
            const normalized = {
              id: row.id,
              created_at: row.created_at,
              event_type: row.event_type,
              actor_id: row.actor_id,
              actor_type: row.actor_type,
              target_resource: row.target_resource,
              ip_address: row.ip_address,
              details: row.details,
              organization_id: row.organization_id,
            };
            await writeToGzip(gzip, JSON.stringify(normalized) + "\n");
            ids.push(row.id as string);
          }
          lastId = data[data.length - 1].id as string;
        }
        gzip.end();
      } catch (err) {
        gzip.destroy();
        reject(err);
      }
    })();
  });
  return { buffer, ids };
}

function writeToGzip(gzip: ReturnType<typeof createGzip>, chunk: string): Promise<void> {
  return new Promise((resolve) => {
    const ok = gzip.write(chunk, "utf8");
    if (ok) {
      resolve();
    } else {
      gzip.once("drain", resolve);
    }
  });
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1, 0, 0, 0, 0));
}

function formatMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
