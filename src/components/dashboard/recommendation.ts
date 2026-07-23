import type { ComplianceScore } from "@/components/ClauseEngine";
import type { DbProject } from "@/lib/projects-db";
import type { QuickToolKey } from "@/lib/tools/usage";
import type { ScanUsage } from "@/lib/billing/usage";

export interface DashboardRecommendation {
  title: string;
  description: string;
  why: string;
  href: string;
  ctaLabel: string;
}

export interface RecommendationInput {
  aggregateScore: ComplianceScore | null;
  projects: DbProject[];
  completedTools: QuickToolKey[];
  scanUsage: ScanUsage | null;
}

const MAJOR_REGIMES = ["eu_gdpr", "california_ccpa"];

export function setupCompletion(projects: DbProject[], completedTools: QuickToolKey[]): number {
  const completed = [
    projects.length > 0,
    projects.some((project) => project.targetRegions.some((region) => MAJOR_REGIMES.includes(region))),
    completedTools.includes("cookie_banner"),
    completedTools.includes("dpa"),
    completedTools.includes("subprocessors"),
  ].filter(Boolean).length;
  return Math.round((completed / 5) * 100);
}

export function selectRecommendation({
  aggregateScore,
  projects,
  completedTools,
  scanUsage,
}: RecommendationInput): DashboardRecommendation {
  if (projects.length === 0) {
    return {
      title: "Generate Your First Compliance Package",
      description: "Create a tailored baseline for your site and turn an empty workspace into an actionable plan.",
      why: "A package gives your team the starting score, documents, and next steps needed to make progress visible.",
      href: "/dashboard",
      ctaLabel: "Generate Package",
    };
  }

  const attentionProject = projects.find((project) => project.status !== "current");
  if (attentionProject) {
    return {
      title: `Review ${attentionProject.name}`,
      description: "This project needs attention because its compliance status is no longer current.",
      why: "Reviewing outdated or action-needed projects keeps your compliance baseline aligned with changing requirements.",
      href: `/dashboard/projects/${attentionProject.id}`,
      ctaLabel: "Review Project",
    };
  }

  if (aggregateScore && aggregateScore.overall < 60) {
    return {
      title: "Strengthen Your Compliance Baseline",
      description: "Your current score shows a few important gaps that are worth addressing next.",
      why: "Closing the largest gaps first gives your team the fastest path to a more resilient compliance program.",
      href: `/dashboard/projects/${projects[0].id}`,
      ctaLabel: "Review Score",
    };
  }

  if (scanUsage && scanUsage.limit !== Infinity && scanUsage.used >= scanUsage.limit) {
    return {
      title: "Review Your Scan Allowance",
      description: "You have used this period's included scans.",
      why: "Keeping scan coverage active helps you catch changes before they become launch or audit blockers.",
      href: "/dashboard/alerts",
      ctaLabel: "View Plan Options",
    };
  }

  const nextTool = [
    { key: "cookie_banner", label: "Add a Cookie Consent Banner", href: "/dashboard/tools/cookie-banner" },
    { key: "dpa", label: "Generate a DPA for Your Vendors", href: "/dashboard/tools/dpa" },
    { key: "subprocessors", label: "Map Your Subprocessors", href: "/dashboard/tools/subprocessors" },
  ].find((tool) => !completedTools.includes(tool.key as QuickToolKey));

  if (nextTool) {
    return {
      title: nextTool.label,
      description: "Continue building the practical controls around your compliance package.",
      why: "Completing the next foundational control turns your score into coverage your team can use day to day.",
      href: nextTool.href,
      ctaLabel: "Continue Setup",
    };
  }

  return {
    title: "Keep Your Compliance Current",
    description:
      "Your core setup is complete. Run a fresh scan whenever your site changes — Autopilot monitors regulatory updates for you.",
    why: "Regular reviews help your team spot drift early and keep evidence ready for customers and auditors.",
    href: "#scanner",
    ctaLabel: "Run a Compliance Scan",
  };
}
