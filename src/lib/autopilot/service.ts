// Autopilot server service — the DB-touching glue between the pure diff/pipeline
// logic and Supabase. User-facing reads/writes go through the RLS-scoped server
// client; the cron run uses the service-role admin client to fan out across users.

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEntitlement } from "@/lib/entitlements";
import { getAiClient, type AiClient } from "@/services/ai";
import { logger } from "@/services";
import type {
  Framework,
  TrackingPixel,
  TargetRegion,
  ComplianceModule,
  ComplianceScore,
} from "@/components/ClauseEngine";
import { detectRegulationChange } from "./diff-engine";
import { buildRegenerationProposal, type ProjectInputsSnapshot } from "./pipeline";

const log = logger.child({ module: "autopilot" });

export interface ProposalListItem {
  id: string;
  projectId: string;
  projectName: string;
  status: "proposed" | "accepted" | "rejected" | "superseded";
  regulationId: string | null;
  summary: string;
  diff: unknown;
  createdAt: string;
  resolvedAt: string | null;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  relatedProjectId: string | null;
  relatedVersionId: string | null;
  createdAt: string;
}

/** Lists the current user's proposals (defaults to those awaiting review). */
export async function listProposals(status: "proposed" | "all" = "proposed"): Promise<ProposalListItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("document_versions")
    .select("id, project_id, status, regulation_id, summary, diff, created_at, resolved_at, projects(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (status === "proposed") query = query.eq("status", "proposed");

  const { data, error } = await query;
  if (error || !data) return [];

  return data.map((row) => {
    const project = row.projects as { name?: string } | { name?: string }[] | null;
    const projectName = Array.isArray(project) ? (project[0]?.name ?? "Project") : (project?.name ?? "Project");
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      projectName,
      status: row.status as ProposalListItem["status"],
      regulationId: (row.regulation_id as string | null) ?? null,
      summary: (row.summary as string) ?? "",
      diff: row.diff,
      createdAt: row.created_at as string,
      resolvedAt: (row.resolved_at as string | null) ?? null,
    };
  });
}

export type ResolveAction = "accept" | "reject";

/**
 * Accepts or rejects a proposal. Accepting applies the proposed package + score
 * to the underlying project. RLS ensures a user can only touch their own rows.
 */
export async function resolveProposal(id: string, action: ResolveAction): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: proposal, error } = await supabase
    .from("document_versions")
    .select("id, project_id, status, package_markdown, compliance_score")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !proposal) return false;
  if (proposal.status !== "proposed") return false;

  const now = new Date().toISOString();

  if (action === "accept") {
    const { error: applyErr } = await supabase
      .from("projects")
      .update({
        package_markdown: proposal.package_markdown,
        compliance_score: proposal.compliance_score,
        status: "current",
        updated_at: now,
      })
      .eq("id", proposal.project_id)
      .eq("user_id", user.id);
    if (applyErr) return false;
  }

  const { error: resolveErr } = await supabase
    .from("document_versions")
    .update({ status: action === "accept" ? "accepted" : "rejected", resolved_at: now })
    .eq("id", id)
    .eq("user_id", user.id);
  return !resolveErr;
}

export async function listNotifications(): Promise<NotificationItem[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, title, body, read, related_project_id, related_version_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    type: row.type as string,
    title: row.title as string,
    body: (row.body as string) ?? "",
    read: Boolean(row.read),
    relatedProjectId: (row.related_project_id as string | null) ?? null,
    relatedVersionId: (row.related_version_id as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function markNotificationRead(id: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
  return !error;
}

// ─── Cron run ─────────────────────────────────────────────────────────────────

/** One observed regulation source, supplied by the cron's fetcher. */
export interface RegulationUpdate {
  id: string;
  name: string;
  region: TargetRegion | string;
  content: string;
  changeNote?: string;
  sourceUrl?: string;
}

export interface AutopilotRunResult {
  regulationsChanged: number;
  proposalsCreated: number;
}

interface AdminProjectRow {
  id: string;
  user_id: string;
  name: string;
  framework: string;
  tracking_pixels: string[] | null;
  target_regions: string[] | null;
  compliance_modules: string[] | null;
  package_markdown: string;
}

/**
 * Autopilot pipeline entrypoint (invoked by the daily cron). For each changed
 * regulation it records a new regulation_version, then creates a *proposed*
 * document_version + notification for every premium user's project that targets
 * the affected region. Propose-only: live projects are never mutated here.
 */
export async function runAutopilot(
  updates: RegulationUpdate[],
  ai: AiClient = getAiClient()
): Promise<AutopilotRunResult> {
  const admin = createAdminClient();
  let regulationsChanged = 0;
  let proposalsCreated = 0;

  // Premium users only (Autopilot is a Pro-tier feature).
  const { data: premium } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("status", "active")
    .neq("tier", "free");
  const premiumUserIds = new Set((premium ?? []).map((r) => r.user_id as string));
  if (premiumUserIds.size === 0) return { regulationsChanged: 0, proposalsCreated: 0 };

  for (const update of updates) {
    const { data: existing } = await admin
      .from("regulations")
      .select("current_version, content_hash")
      .eq("id", update.id)
      .maybeSingle();

    const change = detectRegulationChange(
      existing
        ? { version: existing.current_version as number, contentHash: (existing.content_hash as string) ?? null }
        : null,
      update.content
    );
    const now = new Date().toISOString();

    // Upsert the regulation catalog row regardless (keeps last_checked_at fresh).
    await admin.from("regulations").upsert(
      {
        id: update.id,
        name: update.name,
        region: String(update.region),
        source_url: update.sourceUrl ?? null,
        current_version: change.changed ? change.nextVersion : (existing?.current_version ?? 1),
        content_hash: change.nextHash,
        last_checked_at: now,
        updated_at: now,
      },
      { onConflict: "id" }
    );

    if (!change.changed) continue;
    regulationsChanged += 1;

    await admin.from("regulation_versions").insert({
      regulation_id: update.id,
      version: change.nextVersion,
      summary: update.name,
      content_hash: change.nextHash,
      change_note: update.changeNote ?? "Source content changed.",
    });

    // Affected projects: premium owners targeting this region.
    const { data: projects } = await admin
      .from("projects")
      .select("id, user_id, name, framework, tracking_pixels, target_regions, compliance_modules, package_markdown")
      .contains("target_regions", [String(update.region)]);

    for (const row of (projects ?? []) as AdminProjectRow[]) {
      if (!premiumUserIds.has(row.user_id)) continue;

      const snapshot: ProjectInputsSnapshot = {
        name: row.name,
        framework: row.framework as Framework,
        trackingPixels: (row.tracking_pixels ?? []) as TrackingPixel[],
        targetRegions: (row.target_regions ?? []) as TargetRegion[],
        complianceModules: (row.compliance_modules ?? []) as ComplianceModule[],
        packageMarkdown: row.package_markdown ?? "",
      };

      const proposal = await buildRegenerationProposal({
        project: snapshot,
        regulation: {
          id: update.id,
          name: update.name,
          region: String(update.region),
          changeNote: update.changeNote ?? "Source content changed.",
        },
        ai,
      });
      if (!proposal.hasChanges) continue;

      const { data: inserted } = await admin
        .from("document_versions")
        .insert({
          project_id: row.id,
          user_id: row.user_id,
          status: "proposed",
          triggered_by: "autopilot",
          regulation_id: update.id,
          summary: proposal.summary,
          diff: proposal.diff as unknown as Record<string, unknown>,
          package_markdown: proposal.packageMarkdown,
          compliance_score: proposal.complianceScore as unknown as ComplianceScore,
        })
        .select("id")
        .single();

      await admin.from("projects").update({ status: "action_needed", updated_at: now }).eq("id", row.id);

      await admin.from("notifications").insert({
        user_id: row.user_id,
        type: "document_proposed",
        title: `${update.name} update — review ${row.name}`,
        body: proposal.summary,
        related_project_id: row.id,
        related_version_id: inserted?.id ?? null,
      });
      proposalsCreated += 1;
    }
  }

  log.info("Autopilot run complete", { regulationsChanged, proposalsCreated, aiClient: ai.id });
  return { regulationsChanged, proposalsCreated };
}

/** Whether the current user may use Autopilot (Pro-tier gate). */
export async function canUseAutopilot(): Promise<boolean> {
  const entitlement = await getEntitlement();
  return entitlement.isPremium;
}
