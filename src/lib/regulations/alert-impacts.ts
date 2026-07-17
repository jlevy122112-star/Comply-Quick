// Alert impacts data layer (C11).
//
// Materializes per-project regulatory exposure rows created by the Autopilot
// pipeline, and reads them back to drive the displayed score penalty + the
// alerts center. Risk level is inferred deterministically from the regenerated
// diff's magnitude so the penalty is reproducible.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, organizationReadFilter } from "@/lib/organizations-db";
import type { PendingRegulatoryPressure } from "./score-impact";
import { PENALTY_BY_RISK } from "./score-impact";

export type RiskLevel = PendingRegulatoryPressure["riskLevel"];

export interface AlertImpact {
  id: string;
  projectId: string;
  regulationId: string;
  regulationName: string;
  riskLevel: RiskLevel;
  scorePenalty: number;
  status: "open" | "resolved";
  createdAt: string;
  resolvedAt: string | null;
}

/** Infers a risk level from a regenerated package diff's line churn. Pure. */
export function riskFromDiff(addedLines: number, removedLines: number): RiskLevel {
  const churn = addedLines + removedLines;
  if (churn >= 40) return "high";
  if (churn >= 12) return "medium";
  return "low";
}

interface ImpactRow {
  id: string;
  project_id: string;
  regulation_id: string;
  regulation_name: string;
  risk_level: RiskLevel;
  score_penalty: number;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
}

function rowToImpact(row: ImpactRow): AlertImpact {
  return {
    id: row.id,
    projectId: row.project_id,
    regulationId: row.regulation_id,
    regulationName: row.regulation_name,
    riskLevel: row.risk_level,
    scorePenalty: row.score_penalty,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

/**
 * Records an impact row for a newly-created proposal (service-role admin client
 * from the cron). Best-effort: a failure never aborts the autopilot run.
 */
export async function recordAlertImpact(
  admin: SupabaseClient,
  input: {
    userId: string;
    projectId: string;
    versionId: string | null;
    regulationId: string;
    regulationName: string;
    riskLevel: RiskLevel;
  }
): Promise<void> {
  let organizationId: string | null = null;
  try {
    const { data: project } = await admin
      .from("projects")
      .select("organization_id")
      .eq("id", input.projectId)
      .maybeSingle();
    organizationId = (project as { organization_id: string | null } | null)?.organization_id ?? null;
  } catch {
    organizationId = null;
  }

  if (!organizationId) {
    try {
      const { data: organization } = await admin
        .from("organizations")
        .select("id")
        .eq("owner_id", input.userId)
        .maybeSingle();
      organizationId = (organization as { id: string } | null)?.id ?? null;
    } catch {
      organizationId = null;
    }
  }

  await admin.from("alert_impacts").insert({
    user_id: input.userId,
    organization_id: organizationId,
    project_id: input.projectId,
    version_id: input.versionId,
    regulation_id: input.regulationId,
    regulation_name: input.regulationName,
    risk_level: input.riskLevel,
    score_penalty: PENALTY_BY_RISK[input.riskLevel],
    status: "open",
  });
}

/** Lists the current user's open impacts (RLS-scoped). */
export async function listOpenImpacts(): Promise<AlertImpact[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();
  const { data } = await supabase
    .from("alert_impacts")
    .select(
      "id, project_id, regulation_id, regulation_name, risk_level, score_penalty, status, created_at, resolved_at"
    )
    .or(organizationReadFilter(user.id, organizationId))
    .eq("status", "open")
    .order("created_at", { ascending: false });
  return ((data as ImpactRow[] | null) ?? []).map(rowToImpact);
}

/** Open regulatory pressures for a single project → score adjustment inputs. */
export async function pendingPressuresForProject(projectId: string): Promise<PendingRegulatoryPressure[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();
  const { data } = await supabase
    .from("alert_impacts")
    .select("regulation_id, regulation_name, risk_level")
    .or(organizationReadFilter(user.id, organizationId))
    .eq("project_id", projectId)
    .eq("status", "open");
  return ((data as Pick<ImpactRow, "regulation_id" | "regulation_name" | "risk_level">[] | null) ?? []).map((r) => ({
    regulationId: r.regulation_id,
    law: r.regulation_name,
    riskLevel: r.risk_level,
  }));
}

/** Resolves all open impacts tied to a proposal version (on accept/reject). */
export async function resolveImpactsForVersion(versionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("alert_impacts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("version_id", versionId)
    .eq("status", "open");
}
