// Agent runtime shared types.
//
// Comply-Quick's agent accelerators are autonomous workers that operate the
// existing deterministic services (scanner, ClauseEngine, autopilot, alerts)
// on the user's behalf. They never invent legal text — they orchestrate the
// engine and always surface a human-approvable proposal. These types are shared
// across the registry of agents.

import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import type { TargetRegion } from "@/components/ClauseEngine";

/** The customer industries Comply-Quick monitors regulatory change for. */
export const TARGET_INDUSTRIES = [
  "ecommerce",
  "saas",
  "healthcare",
  "fintech",
  "marketing_adtech",
  "general_web",
] as const;
export type TargetIndustry = (typeof TARGET_INDUSTRIES)[number];

export const INDUSTRY_LABELS: Record<TargetIndustry, string> = {
  ecommerce: "E-commerce & Retail",
  saas: "SaaS & Software",
  healthcare: "Healthcare & Health-tech",
  fintech: "Fintech & Payments",
  marketing_adtech: "Marketing & Ad-tech",
  general_web: "General Web / Agencies",
};

// The US state comprehensive-privacy laws currently in effect. Grouped so an
// industry that's subject to "US consumer privacy" picks all of them up at once
// (and new state laws are added in one place).
const US_STATE_PRIVACY: RegulationFrameworkId[] = [
  "ccpa",
  "vcdpa",
  "cpa_colorado",
  "ctdpa_connecticut",
  "ucpa_utah",
  "tdpsa_texas",
];

// Non-EU/US national privacy regimes a global web presence may fall under.
const INTL_PRIVACY: RegulationFrameworkId[] = ["uk_gdpr", "pipeda", "quebec_law25", "lgpd", "australia_privacy_act"];

/**
 * Which frameworks and regions matter to each industry. EVERY registered
 * framework appears in at least one industry so the monitor agent can always
 * route a detected change to affected users (no orphaned frameworks).
 */
export const INDUSTRY_PROFILE: Record<
  TargetIndustry,
  { frameworks: RegulationFrameworkId[]; regions: TargetRegion[] }
> = {
  ecommerce: {
    frameworks: ["pci_dss", "gdpr", "eprivacy", "ftc_act_5", "can_spam", "coppa", ...US_STATE_PRIVACY, ...INTL_PRIVACY],
    regions: ["us_general", "california_ccpa", "eu_gdpr"],
  },
  saas: {
    frameworks: [
      "soc2",
      "iso_27001",
      "gdpr",
      "eu_ai_act",
      "nist_800_53",
      "nist_csf",
      "nist_800_171",
      ...US_STATE_PRIVACY,
      ...INTL_PRIVACY,
    ],
    regions: ["us_general", "california_ccpa", "eu_gdpr"],
  },
  healthcare: {
    frameworks: ["hipaa", "hitech", "soc2", "nist_800_53", "nist_csf", "nist_800_171", "gdpr"],
    regions: ["us_general", "eu_gdpr"],
  },
  fintech: {
    frameworks: ["pci_dss", "soc2", "iso_27001", "nist_800_53", "nist_800_171", "glba", "fcra", "gdpr"],
    regions: ["us_general", "eu_gdpr"],
  },
  marketing_adtech: {
    frameworks: ["gdpr", "eprivacy", "ftc_act_5", "can_spam", "coppa", "eu_ai_act", ...US_STATE_PRIVACY, "uk_gdpr"],
    regions: ["eu_gdpr", "california_ccpa", "us_general"],
  },
  general_web: {
    frameworks: ["gdpr", "iso_27001", "eprivacy", "ftc_act_5", "coppa", ...US_STATE_PRIVACY, ...INTL_PRIVACY],
    regions: ["us_general", "california_ccpa", "eu_gdpr"],
  },
};

/**
 * Jurisdiction override for frameworks whose home region isn't implied by the
 * industry profiles' region arrays (which only span US/California/EU). Without
 * this, a change to e.g. PIPEDA would be routed to US/EU regions rather than
 * Canada. `regionsForFramework` unions these with the industry-derived regions.
 */
export const FRAMEWORK_REGION_OVERRIDES: Partial<Record<RegulationFrameworkId, TargetRegion[]>> = {
  pipeda: ["canada_pipeda"],
  quebec_law25: ["canada_pipeda"],
  lgpd: ["brazil_lgpd"],
  australia_privacy_act: ["australia_privacy"],
};

export type AgentId =
  | "compliance_copilot"
  | "scan_to_fix"
  | "autopilot_remediation"
  | "regulation_monitor"
  | "portfolio_monitor"
  | "audit_evidence"
  | "onboarding"
  | "success_upsell"
  | "qa";

/** The tier at which each agent unlocks (names are immutable: free/solo/agency/enterprise). */
export type AgentTier = "free" | "solo" | "agency" | "enterprise";

export interface AgentDescriptor {
  id: AgentId;
  name: string;
  tagline: string;
  /** Minimum tier that can run the agent's actions (upsell surface). */
  minTier: AgentTier;
}

/** Registry powering the agents UI, gating, and upsell. */
export const AGENT_REGISTRY: Record<AgentId, AgentDescriptor> = {
  compliance_copilot: {
    id: "compliance_copilot",
    name: "Compliance Copilot",
    tagline: "Takes actions — runs scans, generates docs, schedules reviews — with your approval.",
    minTier: "free",
  },
  scan_to_fix: {
    id: "scan_to_fix",
    name: "Scan-to-Fix Agent",
    tagline: "Turns scan findings into a prioritized, one-click remediation plan.",
    minTier: "solo",
  },
  autopilot_remediation: {
    id: "autopilot_remediation",
    name: "Autopilot Remediation Agent",
    tagline: "Watches regulatory changes and drafts approval-gated document updates.",
    minTier: "solo",
  },
  regulation_monitor: {
    id: "regulation_monitor",
    name: "Regulation Monitor Agent",
    tagline: "Learns every appropriate agency and alerts you the moment a law changes.",
    minTier: "solo",
  },
  portfolio_monitor: {
    id: "portfolio_monitor",
    name: "Portfolio Monitoring Agent",
    tagline: "Flags at-risk client projects and drafts client-ready reports.",
    minTier: "agency",
  },
  audit_evidence: {
    id: "audit_evidence",
    name: "Audit & Evidence Agent",
    tagline: "Compiles a framework-specific audit trail and evidence pack on demand.",
    minTier: "enterprise",
  },
  onboarding: {
    id: "onboarding",
    name: "Onboarding Agent",
    tagline: "Classifies your business and recommends the exact modules and jurisdictions to enable.",
    minTier: "free",
  },
  success_upsell: {
    id: "success_upsell",
    name: "Success Agent",
    tagline: "Surfaces the next best action to lower risk and unlock more value.",
    minTier: "free",
  },
  qa: {
    id: "qa",
    name: "QA Agent",
    tagline: "Checks every generated output for completeness before it's released or exported.",
    minTier: "solo",
  },
};

export type AgentRunStatus = "ok" | "no_changes" | "error";

/** A single finding the monitor agent produces when a source changes. */
export interface RegulationChangeFinding {
  framework: RegulationFrameworkId;
  label: string;
  institution: string;
  officialUrl: string;
  previousHash: string | null;
  currentHash: string;
  /** Industries this change is most relevant to, highest-relevance first. */
  affectedIndustries: TargetIndustry[];
  affectedRegions: TargetRegion[];
  detectedAt: string;
}

export interface AgentRunResult {
  agent: AgentId;
  status: AgentRunStatus;
  startedAt: string;
  finishedAt: string;
  summary: string;
  findings: RegulationChangeFinding[];
  error?: string;
}
