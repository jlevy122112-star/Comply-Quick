/**
 * projects.ts
 * Client-side project storage using localStorage.
 * Each project represents a generated compliance package for a client site.
 */

import type {
  Framework,
  TrackingPixel,
  TargetRegion,
  ComplianceScore,
  ComplianceModule,
} from "@/components/ClauseEngine";

export interface SavedProject {
  id: string;
  name: string;
  framework: Framework;
  trackingPixels: TrackingPixel[];
  targetRegions: TargetRegion[];
  complianceModules: ComplianceModule[];
  complianceScore: ComplianceScore;
  createdAt: string;
  updatedAt: string;
  status: "current" | "outdated" | "action_needed";
  packageMarkdown: string;
}

const STORAGE_KEY = "comply-quick-projects";
const TIER_KEY = "comply-quick-tier";

export type PaidTier = "single" | "agency" | "enterprise" | null;

export function getSavedProjects(): SavedProject[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedProject[];
  } catch {
    return [];
  }
}

export function saveProject(project: SavedProject): void {
  const projects = getSavedProjects();
  const idx = projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    projects[idx] = project;
  } else {
    projects.unshift(project);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function deleteProject(id: string): void {
  const projects = getSavedProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
}

export function generateProjectId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getPaidTier(): PaidTier {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(TIER_KEY) as PaidTier) ?? null;
}

export function setPaidTier(tier: PaidTier): void {
  if (tier) {
    localStorage.setItem(TIER_KEY, tier);
  } else {
    localStorage.removeItem(TIER_KEY);
  }
}

export function getAggregateScore(projects: SavedProject[]): ComplianceScore | null {
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
