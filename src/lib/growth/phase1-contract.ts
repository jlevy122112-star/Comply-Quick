import type { Tier } from "@/lib/pricing";

export type FunnelStage = "activation" | "retention" | "expansion" | "advocacy";

export interface KpiDefinition {
  id: string;
  stage: FunnelStage;
  label: string;
  description: string;
  formula: string;
  target: string;
  uiSurfaces: readonly string[];
}

export interface AttributionContract {
  eventVersion: "v1";
  requiredProperties: readonly string[];
  optionalProperties: readonly string[];
  piiPolicy: "no_raw_pii";
}

export const KPI_DICTIONARY: readonly KpiDefinition[] = [
  {
    id: "activation_time_to_first_value",
    stage: "activation",
    label: "Time to First Value",
    description: "Time from signup to first completed compliance package.",
    formula: "median(first_package_timestamp - signup_timestamp)",
    target: "<= 10 minutes",
    uiSurfaces: ["dashboard_wizard", "onboarding", "command_center_insights"],
  },
  {
    id: "activation_completion_rate",
    stage: "activation",
    label: "Activation Completion Rate",
    description: "Share of new accounts completing onboarding + first package in the window.",
    formula: "activated_accounts / new_accounts",
    target: ">= 70% in 7 days",
    uiSurfaces: ["onboarding", "dashboard_wizard", "command_center_insights"],
  },
  {
    id: "retention_active_retention",
    stage: "retention",
    label: "Active Retention",
    description: "Share of subscribed accounts still active.",
    formula: "active_subscriptions / total_subscriptions",
    target: ">= 90% annualized",
    uiSurfaces: ["command_center", "cancel_flow", "pmf_dashboard"],
  },
  {
    id: "retention_churn_rate",
    stage: "retention",
    label: "Churn Rate",
    description: "Share of subscriptions canceled in the measurement period.",
    formula: "canceled_subscriptions / total_subscriptions",
    target: "<= 10% annualized SMB baseline",
    uiSurfaces: ["cancel_flow", "pmf_dashboard", "command_center_insights"],
  },
  {
    id: "expansion_trial_to_paid",
    stage: "expansion",
    label: "Trial to Paid",
    description: "Share of signups converting to paid subscription.",
    formula: "paid_subscriptions / total_signups",
    target: "Quarter-over-quarter growth",
    uiSurfaces: ["pricing", "checkout", "command_center_insights"],
  },
  {
    id: "expansion_nrr",
    stage: "expansion",
    label: "Net Revenue Retention",
    description: "Recurring revenue retained including expansions minus churn.",
    formula: "(starting_mrr + expansion_mrr - churn_mrr) / starting_mrr",
    target: ">= 120% enterprise cohort",
    uiSurfaces: ["partners", "agency_portal", "command_center_insights"],
  },
  {
    id: "advocacy_nps",
    stage: "advocacy",
    label: "Net Promoter Score",
    description: "Customer likelihood to recommend Comply-Quick.",
    formula: "%promoters - %detractors",
    target: ">= 40",
    uiSurfaces: ["pmf_dashboard", "command_center", "nps_survey"],
  },
  {
    id: "advocacy_referral_conversion",
    stage: "advocacy",
    label: "Referral Conversion Rate",
    description: "Share of referral-attributed sessions that become paid.",
    formula: "paid_referral_accounts / referral_accounts",
    target: "10-20% of new business via referral channels",
    uiSurfaces: ["partners", "marketplace", "command_center_insights"],
  },
];

export const ATTRIBUTION_CONTRACT: AttributionContract = {
  eventVersion: "v1",
  requiredProperties: ["surface", "module", "plan_tier", "session_id", "attribution_channel"],
  optionalProperties: ["campaign_id", "integration_id", "experiment_id", "variant", "value"],
  piiPolicy: "no_raw_pii",
};

export const FEATURE_GATE_MATRIX: Record<string, { minimumTier: Tier; uiSurfaces: readonly string[]; owner: string }> =
  {
    core_wizard: { minimumTier: "free", uiSurfaces: ["dashboard_wizard"], owner: "product" },
    compliance_scanner: { minimumTier: "solo", uiSurfaces: ["dashboard_home_scanner"], owner: "product" },
    integrations_center: { minimumTier: "solo", uiSurfaces: ["settings_integrations"], owner: "platform" },
    continuous_alerts: { minimumTier: "enterprise", uiSurfaces: ["dashboard_alerts"], owner: "platform" },
    evidence_pack: { minimumTier: "agency", uiSurfaces: ["dashboard_evidence"], owner: "compliance" },
    approvals_queue: { minimumTier: "agency", uiSurfaces: ["dashboard_approvals"], owner: "compliance" },
    audit_trail: { minimumTier: "agency", uiSurfaces: ["dashboard_audit"], owner: "compliance" },
    legal_review_center: { minimumTier: "enterprise", uiSurfaces: ["dashboard_legal_review"], owner: "legal" },
    partner_portal: { minimumTier: "agency", uiSurfaces: ["dashboard_partners"], owner: "growth" },
  };
