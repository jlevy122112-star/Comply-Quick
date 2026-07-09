// Onboarding Agent.
//
// Turns a few setup answers into a classified project profile: the industry it
// belongs to, the compliance frameworks/jurisdictions it should track, and an
// approval-gated plan to enable those modules and establish a baseline scan.
// Pure and deterministic — the rules engine (INDUSTRY_PROFILE) decides module
// inclusion; the agent only recommends and proposes.

import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import type { TargetRegion } from "@/components/ClauseEngine";
import { INDUSTRY_PROFILE, INDUSTRY_LABELS, type TargetIndustry } from "./types";
import { action, orderPlan, type AgentActionPlan } from "./actions";

export interface OnboardingAnswers {
  /** Free-text description of the business/product. */
  description: string;
  /** Whether the site sells online / takes payments. */
  sellsOnline?: boolean;
  /** Whether it handles health data. */
  handlesHealthData?: boolean;
  /** Whether it serves EU/UK users. */
  servesEu?: boolean;
  /** Whether the account is an agency managing client sites. */
  isAgency?: boolean;
}

export interface OnboardingRecommendation {
  industry: TargetIndustry;
  industryLabel: string;
  frameworks: RegulationFrameworkId[];
  regions: TargetRegion[];
  /** Why this classification was chosen (shown to the user). */
  rationale: string;
  plan: AgentActionPlan;
}

// Word-boundary-anchored so broad substrings don't false-match (e.g. `market`
// must not fire on "supermarket", `app` must not fire on "happy"). The leading
// `\b` on each alternative allows natural suffixes (health→healthcare,
// therap→therapy) while still requiring a real word start.
const KEYWORDS: Record<Exclude<TargetIndustry, "general_web">, RegExp> = {
  healthcare: /\b(health|clinic|patient|medical|hipaa|therap|pharma|wellness)/,
  fintech: /\b(fintech|payment|bank|lending|wallet|crypto|invest|insurance|payroll)/,
  ecommerce: /\b(shop|store|ecommerce|e-commerce|retail|checkout|merch|product|cart)\b/,
  marketing_adtech: /\b(market|ad-?tech|adtech|campaign|analytics|attribution|tracking|seo)\b/,
  saas: /\b(saas|software|platform|api|b2b|app|dashboard|subscription)\b/,
};

// Checked most-specific → most-generic so a description like "health app" or
// "payment dashboard" classifies on the specific term (healthcare/fintech), not
// the broad saas keyword. Order is decoupled from TARGET_INDUSTRIES on purpose.
const SPECIFICITY_ORDER: Exclude<TargetIndustry, "general_web">[] = [
  "healthcare",
  "fintech",
  "ecommerce",
  "marketing_adtech",
  "saas",
];

/** Classifies the project into a target industry from the answers. Pure. */
export function classifyIndustry(answers: OnboardingAnswers): TargetIndustry {
  if (answers.handlesHealthData) return "healthcare";
  const text = answers.description.toLowerCase();
  for (const industry of SPECIFICITY_ORDER) {
    if (KEYWORDS[industry].test(text)) return industry;
  }
  if (answers.sellsOnline) return "ecommerce";
  return "general_web";
}

/**
 * Builds an onboarding recommendation + approval-gated setup plan. Frameworks
 * and regions come straight from the deterministic INDUSTRY_PROFILE; explicit
 * answers (EU users) widen the region set.
 */
export function planOnboarding(answers: OnboardingAnswers): OnboardingRecommendation {
  const industry = classifyIndustry(answers);
  const profile = INDUSTRY_PROFILE[industry];
  const regions = [...profile.regions];
  if (answers.servesEu && !regions.includes("eu_gdpr")) regions.push("eu_gdpr");

  const actions = [
    action(
      "configure_modules",
      `Enable the ${profile.frameworks.length} framework module(s) that apply to a ${INDUSTRY_LABELS[industry]} business.`,
      { industry, frameworks: profile.frameworks, regions: regions.map(String) },
      30
    ),
    action("run_scan", "Run a baseline scan so you have a starting compliance score.", {}, 20),
    action("schedule_review", "Schedule a recurring review so compliance stays current.", {}, 10),
  ];

  const rationale =
    `Classified as ${INDUSTRY_LABELS[industry]} based on your setup answers. ` +
    `Recommending ${profile.frameworks.length} framework(s) across ${regions.length} region(s). ` +
    `Review and approve to finish setup — nothing runs until you confirm.`;

  return {
    industry,
    industryLabel: INDUSTRY_LABELS[industry],
    frameworks: profile.frameworks,
    regions,
    rationale,
    plan: orderPlan({ agent: "onboarding", title: "Recommended setup", rationale, actions }),
  };
}
