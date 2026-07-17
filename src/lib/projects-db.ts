import type {
  Framework,
  TrackingPixel,
  TargetRegion,
  ComplianceScore,
  ComplianceModule,
} from "@/components/ClauseEngine";
import { getActiveOrganizationId, organizationReadFilter } from "@/lib/organizations-db";
import { createClient } from "@/lib/supabase/server";

export interface DbProject {
  id: string;
  name: string;
  framework: Framework;
  trackingPixels: TrackingPixel[];
  targetRegions: TargetRegion[];
  complianceModules: ComplianceModule[];
  complianceScore: ComplianceScore;
  status: "current" | "outdated" | "action_needed";
  packageMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewProjectInput {
  name: string;
  framework: Framework;
  trackingPixels: TrackingPixel[];
  targetRegions: TargetRegion[];
  complianceModules: ComplianceModule[];
  complianceScore: ComplianceScore;
  packageMarkdown: string;
}

interface ProjectRow {
  id: string;
  name: string;
  framework: string;
  tracking_pixels: string[];
  target_regions: string[];
  compliance_modules: string[];
  compliance_score: ComplianceScore;
  status: string;
  package_markdown: string;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): DbProject {
  return {
    id: row.id,
    name: row.name,
    framework: row.framework as Framework,
    trackingPixels: (row.tracking_pixels ?? []) as TrackingPixel[],
    targetRegions: (row.target_regions ?? []) as TargetRegion[],
    complianceModules: (row.compliance_modules ?? []) as ComplianceModule[],
    complianceScore: row.compliance_score,
    status: row.status as DbProject["status"],
    packageMarkdown: row.package_markdown,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProjects(): Promise<DbProject[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const organizationId = await getActiveOrganizationId();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .or(organizationReadFilter(user.id, organizationId))
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return (data as ProjectRow[]).map(rowToProject);
}

export async function getProjectById(id: string): Promise<DbProject | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const organizationId = await getActiveOrganizationId();

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .or(organizationReadFilter(user.id, organizationId))
    .maybeSingle();

  if (error || !data) return null;
  return rowToProject(data as ProjectRow);
}

export async function createProject(input: NewProjectInput): Promise<DbProject | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const organizationId = await getActiveOrganizationId();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      organization_id: organizationId,
      name: input.name,
      framework: input.framework,
      tracking_pixels: input.trackingPixels,
      target_regions: input.targetRegions,
      compliance_modules: input.complianceModules,
      compliance_score: input.complianceScore,
      package_markdown: input.packageMarkdown,
    })
    .select("*")
    .single();

  if (error || !data) return null;
  return rowToProject(data as ProjectRow);
}

/**
 * Applies a regenerated compliance package to a project (owner-scoped). Used by
 * the workspace "Regenerate & review" flow after the user approves the diff.
 */
export async function updateProjectPackage(
  id: string,
  packageMarkdown: string,
  complianceScore: ComplianceScore
): Promise<DbProject | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("projects")
    .update({
      package_markdown: packageMarkdown,
      compliance_score: complianceScore,
      status: "current",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error || !data) return null;
  return rowToProject(data as ProjectRow);
}

export async function deleteProjectById(id: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { error } = await supabase.from("projects").delete().eq("id", id).eq("user_id", user.id);
  return !error;
}

export function getAggregateScore(projects: DbProject[]): ComplianceScore | null {
  if (projects.length === 0) return null;
  const sum = projects.reduce(
    (acc, p) => ({
      overall: acc.overall + p.complianceScore.overall,
      contractProtection: acc.contractProtection + p.complianceScore.contractProtection,
      privacyCoverage: acc.privacyCoverage + p.complianceScore.privacyCoverage,
      preLaunchReadiness: acc.preLaunchReadiness + p.complianceScore.preLaunchReadiness,
      regulatoryBreadth: acc.regulatoryBreadth + p.complianceScore.regulatoryBreadth,
    }),
    { overall: 0, contractProtection: 0, privacyCoverage: 0, preLaunchReadiness: 0, regulatoryBreadth: 0 }
  );
  const n = projects.length;
  return {
    overall: Math.round(sum.overall / n),
    contractProtection: Math.round(sum.contractProtection / n),
    privacyCoverage: Math.round(sum.privacyCoverage / n),
    preLaunchReadiness: Math.round(sum.preLaunchReadiness / n),
    regulatoryBreadth: Math.round(sum.regulatoryBreadth / n),
  };
}
