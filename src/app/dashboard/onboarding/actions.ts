"use server";

import { revalidatePath } from "next/cache";
import {
  generateCompliancePackage,
  exportToMarkdown,
  type Framework,
  type TargetRegion,
} from "@/components/ClauseEngine";
import type { ComplianceModule } from "@/components/EnterpriseModules";
import { createProject } from "@/lib/projects-db";
import { planOnboarding, type OnboardingAnswers, type OnboardingRecommendation } from "@/lib/agents/onboarding";
import type { TargetIndustry } from "@/lib/agents/types";

/**
 * Enterprise compliance modules the Onboarding agent recommends per industry.
 * Maps the agent's classified industry onto the concrete module shields the
 * ClauseEngine can generate (hipaa/pci_dss/ada_wcag/soc2).
 */
const INDUSTRY_MODULES: Record<TargetIndustry, ComplianceModule[]> = {
  healthcare: ["hipaa", "soc2"],
  fintech: ["pci_dss", "soc2"],
  ecommerce: ["pci_dss", "ada_wcag"],
  saas: ["soc2"],
  marketing_adtech: ["ada_wcag"],
  general_web: ["ada_wcag"],
};

/** Returns the agent's recommendation for the given answers (no writes). */
export async function recommendOnboardingAction(answers: OnboardingAnswers): Promise<OnboardingRecommendation> {
  return planOnboarding(answers);
}

export interface OnboardingSetupInput {
  answers: OnboardingAnswers;
  framework: Framework;
  projectName: string;
}

/**
 * Human-in-the-loop apply step: once the user reviews and approves the agent's
 * recommendation, materialize it into a real project — the recommended
 * frameworks/regions/modules generate a baseline compliance package and score.
 */
export async function createProjectFromOnboardingAction(
  input: OnboardingSetupInput
): Promise<{ ok: true; projectId: string } | { ok: false; error: string }> {
  const rec = planOnboarding(input.answers);
  const modules = INDUSTRY_MODULES[rec.industry] ?? [];
  const targetRegions: TargetRegion[] = rec.regions;

  const pkg = generateCompliancePackage({
    userType: input.answers.isAgency ? "developer" : "merchant",
    framework: input.framework,
    trackingPixels: [],
    targetRegions,
    complianceModules: modules.length > 0 ? modules : undefined,
  });

  const project = await createProject({
    name: input.projectName.trim() || `${rec.industryLabel} project`,
    framework: input.framework,
    trackingPixels: [],
    targetRegions,
    complianceModules: modules,
    complianceScore: pkg.complianceScore,
    packageMarkdown: exportToMarkdown(pkg),
  });

  if (!project) return { ok: false, error: "Could not create the project. Please sign in and try again." };
  revalidatePath("/dashboard/home");
  return { ok: true, projectId: project.id };
}
