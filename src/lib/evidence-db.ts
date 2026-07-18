// Audit & Evidence — server data layer (framework §3.3 / A3).
//
// Persists the Audit & Evidence agent's per-control evidence state to
// `evidence_records` so it survives across sessions, feeds back into the next
// pack compilation as the ledger, and powers an auditor-ready Evidence view.
// All reads/writes go through the RLS-scoped server client.

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, organizationReadFilter } from "@/lib/organizations-db";
import type { AuditEvidencePack, EvidenceLedger, EvidenceStatus } from "@/lib/agents";
import type { RegulationControl } from "@/lib/regulations/types";

export interface EvidenceRecord {
  id: string;
  framework: string;
  projectId: string | null;
  controlId: string;
  controlTitle: string;
  riskLevel: RegulationControl["riskLevel"];
  status: EvidenceStatus;
  requiredEvidence: string[];
  evidenceRef: string | null;
  sourceUrl: string;
  generatedAt: string;
  updatedAt: string;
}

interface EvidenceRow {
  id: string;
  framework: string;
  project_id: string | null;
  control_id: string;
  control_title: string;
  risk_level: RegulationControl["riskLevel"];
  status: EvidenceStatus;
  required_evidence: string[];
  evidence_ref: string | null;
  source_url: string;
  generated_at: string;
  updated_at: string;
}

function rowToRecord(r: EvidenceRow): EvidenceRecord {
  return {
    id: r.id,
    framework: r.framework,
    projectId: r.project_id,
    controlId: r.control_id,
    controlTitle: r.control_title,
    riskLevel: r.risk_level,
    status: r.status,
    requiredEvidence: r.required_evidence ?? [],
    evidenceRef: r.evidence_ref,
    sourceUrl: r.source_url,
    generatedAt: r.generated_at,
    updatedAt: r.updated_at,
  };
}

const COLS =
  "id, framework, project_id, control_id, control_title, risk_level, status, required_evidence, evidence_ref, source_url, generated_at, updated_at";

/**
 * Persists a compiled evidence pack: organization-tagged rows are keyed on
 * (organization_id, framework, control_id, project_id), while legacy
 * NULL-organization rows retain the user-scoped key. Existing collected/N-A
 * statuses set by the user are preserved by the ledger the pack was compiled
 * with, so a re-compile never silently discards prior evidence state.
 * Best-effort - returns false on failure rather than throwing, so it never
 * breaks the agent run.
 */
export async function saveEvidencePack(pack: AuditEvidencePack, projectId: string | null = null): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const organizationId = await getActiveOrganizationId();
  const organizationFields = organizationId ? { organization_id: organizationId } : {};
  const now = new Date().toISOString();
  const rows = pack.items.map((item) => ({
    user_id: user.id,
    ...organizationFields,
    project_id: projectId,
    framework: pack.framework,
    control_id: item.controlId,
    control_title: item.controlTitle,
    risk_level: item.riskLevel,
    status: item.status,
    required_evidence: item.requiredEvidence,
    source_url: item.sourceUrl,
    generated_at: pack.generatedAt,
    updated_at: now,
  }));
  if (rows.length === 0) return true;

  // NULL project_id can't be a PostgREST `onConflict` upsert target - the
  // partial unique index from 0026 (…WHERE project_id IS NULL) needs an
  // ON CONFLICT WHERE predicate PostgREST can't express. So upsert each row
  // manually: update the existing (user, framework, control, no-project) row if
  // present, else insert. Crucially this never deletes first, so a mid-run
  // failure can only leave some rows un-refreshed — it can never wipe the
  // user's evidence, unlike the previous delete-then-insert.
  if (organizationId) {
    let ok = true;
    for (const row of rows) {
      let query = supabase
        .from("evidence_records")
        .update({
          control_title: row.control_title,
          risk_level: row.risk_level,
          status: row.status,
          required_evidence: row.required_evidence,
          source_url: row.source_url,
          generated_at: row.generated_at,
          updated_at: row.updated_at,
        })
        .eq("organization_id", organizationId)
        .eq("framework", row.framework)
        .eq("control_id", row.control_id);
      query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);
      const { data: updated, error: updateError } = await query.select("id");
      if (updateError) {
        ok = false;
        continue;
      }
      if (updated && updated.length > 0) continue;
      const { error: insertError } = await supabase.from("evidence_records").insert(row as never);
      if (insertError) ok = false;
    }
    return ok;
  }

  if (projectId === null) {
    let ok = true;
    for (const row of rows) {
      const { data: updated, error: updateError } = await supabase
        .from("evidence_records")
        .update({
          control_title: row.control_title,
          risk_level: row.risk_level,
          status: row.status,
          required_evidence: row.required_evidence,
          source_url: row.source_url,
          generated_at: row.generated_at,
          updated_at: row.updated_at,
        })
        .eq("user_id", user.id)
        .eq("framework", row.framework)
        .eq("control_id", row.control_id)
        .is("project_id", null)
        .select("id");
      if (updateError) {
        ok = false;
        continue;
      }
      if (updated && updated.length > 0) continue; // row existed → updated
      const { error: insertError } = await supabase.from("evidence_records").insert(row as never);
      if (insertError) ok = false;
    }
    return ok;
  }

  const { error } = await supabase
    .from("evidence_records")
    .upsert(rows as never[], { onConflict: "user_id,framework,control_id,project_id" });
  return !error;
}

/** Marks one control's evidence status (and optional artifact pointer). */
export async function setEvidenceStatus(
  id: string,
  status: EvidenceStatus,
  evidenceRef?: string | null
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: current } = await supabase
    .from("evidence_records")
    .select("organization_id")
    .eq("id", id)
    .maybeSingle();
  if (!current) return false;

  const rowOrganizationId = (current as { organization_id: string | null }).organization_id;
  const organizationId = await getActiveOrganizationId();
  if (rowOrganizationId && !organizationId) return false;

  let updateQuery = supabase
    .from("evidence_records")
    .update({
      status,
      ...(evidenceRef !== undefined ? { evidence_ref: evidenceRef } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (rowOrganizationId) {
    updateQuery = updateQuery.eq("organization_id", rowOrganizationId);
  } else {
    updateQuery = updateQuery.eq("user_id", user.id).is("organization_id", null);
  }
  const { data: updated, error } = await updateQuery.select("id");
  return !error && !!updated && updated.length > 0;
}

/** Lists persisted evidence records for a framework (optionally project-scoped). */
export async function listEvidenceRecords(
  framework: string,
  projectId: string | null = null
): Promise<EvidenceRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();

  let query = supabase
    .from("evidence_records")
    .select(COLS)
    .or(organizationReadFilter(user.id, organizationId))
    .eq("framework", framework);
  query = projectId ? query.eq("project_id", projectId) : query.is("project_id", null);

  const { data } = await query.order("control_id", { ascending: true });
  return (data ?? []).map((r) => rowToRecord(r as EvidenceRow));
}

/**
 * Rebuilds the agent's evidence ledger (controlId → collected | not_applicable)
 * from persisted rows so a fresh pack compilation reflects prior progress.
 */
export async function getEvidenceLedger(framework: string, projectId: string | null = null): Promise<EvidenceLedger> {
  const records = await listEvidenceRecords(framework, projectId);
  const ledger: EvidenceLedger = {};
  for (const r of records) {
    if (r.status === "collected") ledger[r.controlId] = true;
    else if (r.status === "not_applicable") ledger[r.controlId] = "not_applicable";
  }
  return ledger;
}
