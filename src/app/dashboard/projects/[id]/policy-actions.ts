"use server";

import { revalidatePath } from "next/cache";
import { generateCompliancePackage, exportToMarkdown, type ComplianceScore } from "@/components/ClauseEngine";
import { getProjectById, updateProjectPackage } from "@/lib/projects-db";
import { recordAuditLog } from "@/lib/audit-log";

// Projects don't persist the wizard's userType; regeneration assumes the
// developer perspective (the product's primary audience), matching the
// autopilot pipeline default.
const DEFAULT_USER_TYPE = "developer" as const;

export interface RegeneratePreview {
  ok: boolean;
  before: string;
  after: string;
  hasChanges: boolean;
  score: ComplianceScore | null;
  error?: string;
}

/**
 * Regenerates the project's compliance package from its current stored inputs
 * using the live ClauseEngine and returns a preview (before/after markdown +
 * fresh score) WITHOUT applying it. Human-in-the-loop: the user reviews the diff
 * and explicitly applies via {@link applyRegeneratedPackageAction}.
 */
export async function regeneratePackageAction(projectId: string): Promise<RegeneratePreview> {
  const project = await getProjectById(projectId);
  if (!project)
    return { ok: false, before: "", after: "", hasChanges: false, score: null, error: "Project not found." };

  const pkg = generateCompliancePackage({
    userType: DEFAULT_USER_TYPE,
    framework: project.framework,
    trackingPixels: project.trackingPixels,
    targetRegions: project.targetRegions,
    complianceModules: project.complianceModules,
  });
  const after = exportToMarkdown(pkg);
  const before = project.packageMarkdown;

  return {
    ok: true,
    before,
    after,
    hasChanges: before.trim() !== after.trim(),
    score: pkg.complianceScore,
  };
}

export interface ApplyResult {
  ok: boolean;
  error?: string;
}

/** Applies a reviewed regeneration to the project (owner-scoped) + audit log. */
export async function applyRegeneratedPackageAction(
  projectId: string,
  packageMarkdown: string,
  score: ComplianceScore
): Promise<ApplyResult> {
  const updated = await updateProjectPackage(projectId, packageMarkdown, score);
  if (!updated) return { ok: false, error: "Could not apply the update." };

  await recordAuditLog({
    action: "policy.regenerated",
    entityType: "project",
    entityId: projectId,
    projectId,
    summary: "Regenerated and applied the project's compliance package after reviewing the diff.",
    metadata: { overall: score.overall },
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { ok: true };
}
