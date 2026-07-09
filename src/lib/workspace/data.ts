// Project Compliance Workspace — server data aggregation.
//
// Assembles everything the per-project operating surface needs from genuinely
// project-scoped sources: the project row (score/status/modules) and its
// document_versions (proposals, accepted policy versions, activity). Findings
// and coverage are derived deterministically from the project's stored inputs —
// grounded in the rules engine, never fabricated.

import { getProjectById, type DbProject } from "@/lib/projects-db";
import { listProposals, type ProposalListItem } from "@/lib/autopilot/service";
import { listProjectScans, type ScanRecord } from "@/lib/scanner/service";
import { listProjectTasks, type ProjectTask } from "@/lib/workspace/tasks";
import { listProjectMembers, type ProjectMember } from "@/lib/workspace/members";
import { pendingPressuresForProject } from "@/lib/regulations/alert-impacts";
import { applyRegulatoryImpact, type RegulatoryScoreAdjustment } from "@/lib/regulations/score-impact";
import { MODULE_OPTIONS, type ComplianceModule } from "@/components/EnterpriseModules";
import type { ComplianceScore } from "@/components/ClauseEngine";
import type { Severity } from "@/components/ui/SeverityPill";
import type { ActivityItem } from "@/components/ui/ActivityFeed";

export interface WorkspaceFinding {
  id: string;
  title: string;
  category: string;
  severity: Severity;
  detail: string;
  score: number;
}

export interface CoverageRow {
  module: ComplianceModule;
  label: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface WorkspaceData {
  project: DbProject;
  proposals: ProposalListItem[];
  pendingCount: number;
  findings: WorkspaceFinding[];
  coverage: CoverageRow[];
  activity: ActivityItem[];
  scans: ScanRecord[];
  tasks: ProjectTask[];
  members: ProjectMember[];
  /** Displayed-score adjustment from open (unapproved) regulatory changes. */
  regulatoryImpact: RegulatoryScoreAdjustment;
}

/** Score band → finding severity. Below 60 is critical, 60–79 warning, else info. */
function bandFor(score: number): Severity {
  if (score < 60) return "critical";
  if (score < 80) return "warning";
  return "info";
}

const SCORE_CATEGORIES: { key: keyof ComplianceScore; title: string; category: string; gap: string }[] = [
  {
    key: "contractProtection",
    title: "Contract protection below target",
    category: "Contracts",
    gap: "Add liability-shift clauses (indemnity, limitation of liability) to strengthen contract protection.",
  },
  {
    key: "privacyCoverage",
    title: "Privacy coverage below target",
    category: "Privacy",
    gap: "Declare all tracking pixels and publish a complete privacy policy + consent banner.",
  },
  {
    key: "preLaunchReadiness",
    title: "Pre-launch readiness below target",
    category: "Readiness",
    gap: "Complete outstanding pre-launch checklist items before going live.",
  },
  {
    key: "regulatoryBreadth",
    title: "Regulatory breadth below target",
    category: "Coverage",
    gap: "Enable the compliance modules and jurisdictions that apply to your business.",
  },
];

/**
 * Derives structured findings from the project's stored compliance score. Each
 * sub-90 category becomes a finding so the workspace surfaces exactly where the
 * project is weakest — deterministic and project-scoped (no AI, no fabrication).
 */
export function deriveFindings(score: ComplianceScore): WorkspaceFinding[] {
  return SCORE_CATEGORIES.filter((c) => score[c.key] < 90)
    .map((c) => ({
      id: c.key,
      title: c.title,
      category: c.category,
      severity: bandFor(score[c.key]),
      detail: c.gap,
      score: score[c.key],
    }))
    .sort((a, b) => a.score - b.score);
}

function coverageFor(project: DbProject): CoverageRow[] {
  const enabled = new Set(project.complianceModules);
  return MODULE_OPTIONS.map((m) => ({
    module: m.value,
    label: m.label,
    icon: m.icon,
    description: m.description,
    enabled: enabled.has(m.value),
  }));
}

function activityFor(project: DbProject, proposals: ProposalListItem[]): ActivityItem[] {
  const items: ActivityItem[] = [
    { id: `created-${project.id}`, title: "Project created", timestamp: project.createdAt, tone: "indigo", icon: "📦" },
  ];
  if (project.updatedAt !== project.createdAt) {
    items.push({
      id: `updated-${project.id}`,
      title: "Compliance package updated",
      timestamp: project.updatedAt,
      tone: "sky",
      icon: "✏️",
    });
  }
  for (const p of proposals) {
    items.push({
      id: `proposal-${p.id}`,
      title: p.status === "proposed" ? "Regulatory update proposed" : `Proposal ${p.status}`,
      detail: p.summary,
      timestamp: p.resolvedAt ?? p.createdAt,
      tone: p.status === "proposed" ? "amber" : p.status === "accepted" ? "emerald" : "gray",
      icon: p.status === "proposed" ? "📝" : p.status === "accepted" ? "✅" : "↩️",
    });
  }
  return items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

/** Loads and assembles all workspace data for one project (RLS-scoped). */
export async function getWorkspaceData(projectId: string): Promise<WorkspaceData | null> {
  const project = await getProjectById(projectId);
  if (!project) return null;

  const [proposals, scans, tasks, members, pressures] = await Promise.all([
    listProposals("all", projectId),
    listProjectScans(projectId),
    listProjectTasks(projectId),
    listProjectMembers(projectId),
    pendingPressuresForProject(projectId),
  ]);
  const pendingCount = proposals.filter((p) => p.status === "proposed").length;
  const regulatoryImpact = applyRegulatoryImpact(project.complianceScore.overall, pressures);

  return {
    project,
    proposals,
    pendingCount,
    findings: deriveFindings(project.complianceScore),
    coverage: coverageFor(project),
    activity: activityFor(project, proposals),
    scans,
    tasks,
    members,
    regulatoryImpact,
  };
}
