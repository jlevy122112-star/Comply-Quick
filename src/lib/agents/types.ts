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

/** Which frameworks and regions matter most to each industry. */
export const INDUSTRY_PROFILE: Record<
  TargetIndustry,
  { frameworks: RegulationFrameworkId[]; regions: TargetRegion[] }
> = {
  ecommerce: { frameworks: ["pci_dss", "gdpr", "ccpa"], regions: ["us_general", "california_ccpa", "eu_gdpr"] },
  saas: { frameworks: ["soc2", "iso_27001", "gdpr", "ccpa"], regions: ["us_general", "california_ccpa", "eu_gdpr"] },
  healthcare: { frameworks: ["hipaa", "soc2", "nist_800_53"], regions: ["us_general"] },
  fintech: { frameworks: ["pci_dss", "soc2", "nist_800_53", "gdpr"], regions: ["us_general", "eu_gdpr"] },
  marketing_adtech: { frameworks: ["gdpr", "ccpa"], regions: ["eu_gdpr", "california_ccpa", "us_general"] },
  general_web: { frameworks: ["gdpr", "ccpa", "iso_27001"], regions: ["us_general", "california_ccpa", "eu_gdpr"] },
};

export type AgentId = "regulation_monitor" | "autopilot_remediation";

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
