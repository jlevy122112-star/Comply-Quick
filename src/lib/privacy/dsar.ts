// Data-subject request (DSAR) service layer.
//
// Implements the two core data-subject rights as self-service operations:
//   • export   — assemble a machine-readable copy of the user's personal data
//                 (GDPR Art. 15/20, CCPA/CPRA access & portability).
//   • deletion  — erase the account and all owned data (GDPR Art. 17, CCPA/CPRA
//                 deletion). Deletion removes the Supabase auth user; every
//                 owner-scoped table FKs `auth.users (id) on delete cascade`, so
//                 the child rows are removed atomically by the database.
//
// Every request is written to the append-only `data_subject_requests` ledger so
// there is durable evidence the right was exercised — the ledger row uses a
// plain `user_id` (no cascade) and therefore survives the deletion it records.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DataRequestType = "export" | "deletion";
export type DataRequestStatus = "pending" | "completed" | "failed";

export interface DataSubjectRequest {
  id: string;
  type: DataRequestType;
  status: DataRequestStatus;
  requestedAt: string;
  completedAt: string | null;
  detail: Record<string, unknown> | null;
}

export interface UserDataExport {
  exportedAt: string;
  userId: string;
  email: string | null;
  /** Per-table rows the user owns. Keyed by table name. */
  data: Record<string, unknown[]>;
}

interface ExportTable {
  table: string;
  /** Column selection. Restricted for tables that hold secret material. */
  columns: string;
}

// Curated set of personal-data tables owned by a user via `user_id`. Deletion
// does not need this list (it relies on FK cascade); export does, so we can
// present a labelled, secret-free copy. `api_keys` exposes only metadata — never
// the hashed secret.
const USER_EXPORT_TABLES: readonly ExportTable[] = [
  { table: "projects", columns: "*" },
  { table: "scans", columns: "*" },
  { table: "scan_monitors", columns: "*" },
  { table: "published_scores", columns: "*" },
  { table: "findings", columns: "*" },
  { table: "document_versions", columns: "*" },
  { table: "evidence_records", columns: "*" },
  { table: "subscriptions", columns: "*" },
  { table: "api_keys", columns: "id,name,created_at" },
  { table: "notifications", columns: "*" },
  { table: "notification_preferences", columns: "*" },
  { table: "calendar_feeds", columns: "*" },
  { table: "nps_responses", columns: "*" },
  { table: "churn_surveys", columns: "*" },
];

/** Resolves the currently authenticated user, or null. */
async function currentUser(): Promise<{ id: string; email: string | null } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

/**
 * Assembles a copy of everything the user owns across the curated tables. Uses
 * the service-role client so all rows are visible regardless of RLS, but every
 * query is filtered to `user_id = userId`. A failure on one table (e.g. missing
 * column) degrades to an empty array for that table rather than failing the
 * whole export.
 */
export async function assembleUserExport(userId: string, email: string | null = null): Promise<UserDataExport> {
  const admin = createAdminClient();
  const data: Record<string, unknown[]> = {};

  for (const { table, columns } of USER_EXPORT_TABLES) {
    try {
      const { data: rows, error } = await admin.from(table).select(columns).eq("user_id", userId);
      data[table] = error || !rows ? [] : (rows as unknown[]);
    } catch {
      data[table] = [];
    }
  }

  return { exportedAt: new Date().toISOString(), userId, email, data };
}

/** Writes a request row to the ledger. Returns the row id, or null on failure. */
async function recordRequest(
  userId: string,
  type: DataRequestType,
  status: DataRequestStatus,
  detail: Record<string, unknown> | null
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("data_subject_requests")
    .insert({
      user_id: userId,
      type,
      status,
      detail,
      completed_at: status === "pending" ? null : new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** Marks a ledger row completed/failed. */
async function finalizeRequest(
  id: string,
  status: DataRequestStatus,
  detail: Record<string, unknown> | null
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("data_subject_requests")
    .update({ status, detail, completed_at: new Date().toISOString() })
    .eq("id", id);
}

/** Lists the caller's own request history (RLS-scoped). */
export async function listDataRequests(): Promise<DataSubjectRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_subject_requests")
    .select("id,type,status,requested_at,completed_at,detail")
    .order("requested_at", { ascending: false });
  if (error || !data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: r.type as DataRequestType,
    status: r.status as DataRequestStatus,
    requestedAt: r.requested_at as string,
    completedAt: (r.completed_at as string | null) ?? null,
    detail: (r.detail as Record<string, unknown> | null) ?? null,
  }));
}

export type ExportResult = { ok: true; export: UserDataExport } | { ok: false; error: string };

/**
 * Runs a self-service data export for the current user and logs it. Returns the
 * assembled data for immediate download.
 */
export async function requestDataExport(): Promise<ExportResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const payload = await assembleUserExport(user.id, user.email);
  const rowCounts = Object.fromEntries(Object.entries(payload.data).map(([t, rows]) => [t, rows.length]));
  await recordRequest(user.id, "export", "completed", { rowCounts });
  return { ok: true, export: payload };
}

export type DeletionResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently deletes the current user's account and all owned data. Records a
 * pending ledger row first, deletes the auth user (cascading all owner-scoped
 * tables), then finalizes the ledger. Requires the caller to confirm by passing
 * their exact email address.
 */
export async function requestAccountDeletion(confirmationEmail: string): Promise<DeletionResult> {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!user.email || confirmationEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Type your account email exactly to confirm deletion." };
  }

  const requestId = await recordRequest(user.id, "deletion", "pending", null);

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    if (requestId) await finalizeRequest(requestId, "failed", { message: error.message });
    return { ok: false, error: "Could not delete the account. Please contact support." };
  }

  if (requestId) await finalizeRequest(requestId, "completed", { erased: true });
  return { ok: true };
}
