// Findings & Remediation — server data layer (framework §3.6).
//
// Findings are scan-first: materialized from a scan's analysis the moment it
// completes, so users who only run scans (no project) still get first-class,
// trackable findings. Organization-tagged rows reconcile on
// (organization_id, finding_key), while legacy NULL-organization rows retain
// their per-user identity. A finding that was resolved but re-detected by a
// later scan automatically reopens. All reads/writes go through the
// RLS-scoped server client.

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, organizationReadFilter } from "@/lib/organizations-db";
import { normalizeScanUrl } from "@/lib/scanner/crawler";
import type { Finding as ScanFinding, Severity } from "@/lib/scanner/analyzer";

export type FindingStatus = "open" | "in_progress" | "resolved" | "reopened";

export interface DbFinding {
  id: string;
  scanId: string;
  projectId: string | null;
  findingKey: string;
  category: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
  status: FindingStatus;
  owner: string | null;
  dueDate: string | null;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FindingRow {
  id: string;
  scan_id: string;
  project_id: string | null;
  finding_key: string;
  category: string;
  severity: Severity;
  title: string;
  detail: string;
  recommendation: string;
  status: FindingStatus;
  owner: string | null;
  due_date: string | null;
  first_detected_at: string;
  last_detected_at: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToFinding(r: FindingRow): DbFinding {
  return {
    id: r.id,
    scanId: r.scan_id,
    projectId: r.project_id,
    findingKey: r.finding_key,
    category: r.category,
    severity: r.severity,
    title: r.title,
    detail: r.detail,
    recommendation: r.recommendation,
    status: r.status,
    owner: r.owner,
    dueDate: r.due_date,
    firstDetectedAt: r.first_detected_at,
    lastDetectedAt: r.last_detected_at,
    resolvedAt: r.resolved_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const FINDING_COLS =
  "id, scan_id, project_id, finding_key, category, severity, title, detail, recommendation, status, owner, due_date, first_detected_at, last_detected_at, resolved_at, created_at, updated_at";

/** Stable per-site host used to namespace a finding_key. Falls back to the raw
 * string if the URL can't be parsed (already-normalized or opaque input). */
function siteKey(url: string): string {
  try {
    return normalizeScanUrl(url).hostname.replace(/^www\./, "");
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Deterministic identity for one issue on one site (see migration 0020). */
export function findingKeyFor(url: string, scanFindingId: string): string {
  return `${siteKey(url)}::${scanFindingId}`;
}

function categoryFor(f: ScanFinding): string {
  const id = f.id.toLowerCase();
  if (id.includes("consent") || id.includes("banner")) return "Consent";
  if (id.includes("privacy") || id.includes("policy")) return "Privacy";
  if (id.includes("pixel") || id.includes("tracker") || id.includes("tool")) return "Tracking";
  return "Compliance";
}

/**
 * Materializes a completed scan's findings into first-class rows and reconciles
 * against the site's previously-recorded findings:
 *  - new issue → inserted `open` (+ `created` event)
 *  - recurring issue → refreshed; if it was `resolved`, it reopens (+ events)
 *  - previously-open issue absent from this scan → auto-resolved (+ event)
 *
 * Pure DB side-effects; returns nothing. Best-effort — callers should not block
 * the user's scan result on findings bookkeeping.
 */
export async function materializeScanFindings(
  scanId: string,
  url: string,
  findings: ScanFinding[],
  projectId?: string | null
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const organizationId = await getActiveOrganizationId();
  const site = siteKey(url);
  const now = new Date().toISOString();

  // Existing findings for this site (namespaced by the host prefix). Shared
  // rows are canonical to the active organization; legacy rows remain
  // caller-scoped.
  let existingQuery = supabase.from("findings").select(FINDING_COLS).like("finding_key", `${site}::%`);
  existingQuery = organizationId
    ? existingQuery.eq("organization_id", organizationId)
    : existingQuery.eq("user_id", user.id);
  const { data: existingRows } = await existingQuery;
  const existing = new Map<string, FindingRow>(
    (existingRows ?? []).map((r) => [(r as FindingRow).finding_key, r as FindingRow])
  );

  const seen = new Set<string>();

  for (const f of findings) {
    const key = findingKeyFor(url, f.id);
    seen.add(key);
    let prior = existing.get(key);
    const common = {
      scan_id: scanId,
      category: categoryFor(f),
      severity: f.severity,
      title: f.title,
      detail: f.detail,
      recommendation: f.recommendation,
      last_detected_at: now,
      updated_at: now,
      ...(projectId ? { project_id: projectId } : {}),
    };

    if (!prior) {
      const { data: inserted, error: insertError } = await supabase
        .from("findings")
        .insert({ user_id: user.id, organization_id: organizationId, finding_key: key, status: "open", ...common })
        .select("id")
        .single();
      if (inserted) {
        await supabase.from("finding_events").insert({
          user_id: user.id,
          finding_id: (inserted as { id: string }).id,
          type: "created",
          to_status: "open",
        });
        continue;
      }

      // A concurrent org scan may have inserted the canonical row after the
      // snapshot above. Re-read it and continue through the normal update path
      // instead of losing the latest scan or surfacing a duplicate.
      if (organizationId && insertError) {
        const { data: raced } = await supabase
          .from("findings")
          .select(FINDING_COLS)
          .eq("organization_id", organizationId)
          .eq("finding_key", key)
          .maybeSingle();
        if (raced) {
          existing.set(key, raced as FindingRow);
          prior = raced as FindingRow;
        } else {
          // Before organization canonicalization, this user's legacy row may
          // already own the same key. Adopt it into the active organization
          // instead of losing the finding to the legacy unique index.
          const { data: legacy } = await supabase
            .from("findings")
            .select(FINDING_COLS)
            .eq("user_id", user.id)
            .is("organization_id", null)
            .eq("finding_key", key)
            .maybeSingle();
          if (legacy) {
            prior = legacy as FindingRow;
            await supabase
              .from("findings")
              .update({ organization_id: organizationId })
              .eq("id", prior.id)
              .eq("user_id", user.id)
              .is("organization_id", null);
          }
        }
      }
      if (!prior) continue;
    }

    const reopening = prior.status === "resolved";
    await supabase
      .from("findings")
      .update({
        ...common,
        ...(reopening ? { status: "reopened", resolved_at: null } : {}),
      })
      .eq("id", prior.id);

    await supabase.from("finding_events").insert({
      user_id: user.id,
      finding_id: prior.id,
      type: reopening ? "reopened" : "redetected",
      ...(reopening ? { from_status: "resolved", to_status: "reopened" } : {}),
    });
  }

  // Auto-resolve findings that were open/in_progress/reopened but no longer
  // appear in the latest scan of this site (the underlying issue is gone).
  for (const [key, row] of existing) {
    if (seen.has(key)) continue;
    if (row.status === "resolved") continue;
    await supabase.from("findings").update({ status: "resolved", resolved_at: now, updated_at: now }).eq("id", row.id);
    await supabase.from("finding_events").insert({
      user_id: user.id,
      finding_id: row.id,
      type: "resolved_auto",
      from_status: row.status,
      to_status: "resolved",
    });
  }
}

/** Lists the current user's findings, most-recently-detected first. Optionally
 * scoped to a project (rows whose scan URL was associated with that project). */
export async function listFindings(opts?: { projectId?: string; status?: FindingStatus }): Promise<DbFinding[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();

  let query = supabase
    .from("findings")
    .select(FINDING_COLS)
    .or(organizationReadFilter(user.id, organizationId))
    .order("last_detected_at", { ascending: false });
  if (opts?.projectId) query = query.eq("project_id", opts.projectId);
  if (opts?.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as FindingRow[]).map(rowToFinding);
}

/** Counts the current user's findings with a given status, without fetching
 * rows (uses a head+count query). Optionally scoped to a project. */
export async function countFindings(status: FindingStatus, projectId?: string): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const organizationId = await getActiveOrganizationId();

  let query = supabase
    .from("findings")
    .select("id", { count: "exact", head: true })
    .or(organizationReadFilter(user.id, organizationId))
    .eq("status", status);
  if (projectId) query = query.eq("project_id", projectId);

  const { count } = await query;
  return count ?? 0;
}

/** Updates a finding's status and records the transition. RLS-scoped. */
export async function updateFindingStatus(id: string, status: FindingStatus): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const organizationId = await getActiveOrganizationId();
  const { data: current } = await supabase
    .from("findings")
    .select("status, organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!current) return false;
  const currentRow = current as { status: FindingStatus; organization_id?: string | null };
  const from = currentRow.status;
  const isOrganizationRow = currentRow.organization_id !== null && currentRow.organization_id !== undefined;
  if (isOrganizationRow && !organizationId) return false;

  const now = new Date().toISOString();
  let updateQuery = supabase
    .from("findings")
    .update({
      status,
      updated_at: now,
      resolved_at: status === "resolved" ? now : null,
    })
    .eq("id", id);
  if (isOrganizationRow) {
    updateQuery = updateQuery.eq("organization_id", organizationId as string);
  } else {
    updateQuery = updateQuery.eq("user_id", user.id).is("organization_id", null);
  }
  const { data: updated, error } = await updateQuery.select("id");
  if (error || !updated || updated.length === 0) return false;

  await supabase.from("finding_events").insert({
    user_id: user.id,
    finding_id: id,
    type: "status_changed",
    from_status: from,
    to_status: status,
  });
  return true;
}

/** Assigns (or clears) a finding's owner. RLS-scoped. */
export async function assignFinding(id: string, owner: string | null): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const organizationId = await getActiveOrganizationId();
  let updateQuery = supabase.from("findings").update({ owner, updated_at: new Date().toISOString() }).eq("id", id);
  if (organizationId) {
    updateQuery = updateQuery.eq("organization_id", organizationId);
  } else {
    updateQuery = updateQuery.eq("user_id", user.id).is("organization_id", null);
  }
  const { data: updated, error } = await updateQuery.select("id");
  if (error || !updated || updated.length === 0) return false;

  await supabase.from("finding_events").insert({
    user_id: user.id,
    finding_id: id,
    type: "owner_changed",
    note: owner ?? null,
  });
  return true;
}
