// Agency client onboarding intake — pure schema.
//
// Types, enum tables, and the input normalizer for the onboarding intake. This
// module is intentionally free of any server-only imports (no Supabase client),
// so it can be shared by the client-side wizard AND the server service without
// dragging server code into the browser bundle.

export type IntakeStatus = "draft" | "submitted";

export const PRIMARY_OBJECTIVES = [
  "generate_leads",
  "sell_products",
  "brand_awareness",
  "provide_information",
  "bookings_appointments",
  "other",
] as const;
export type PrimaryObjective = (typeof PRIMARY_OBJECTIVES)[number];

export const VISUAL_STYLES = ["professional", "minimalist", "creative", "luxury", "high_tech", "playful"] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

export const DOMAIN_STATUSES = ["client_owns", "needs_setup", "transfer", "unsure"] as const;
export type DomainStatus = (typeof DOMAIN_STATUSES)[number];

export const BUDGET_RANGES = ["under_5k", "5k_15k", "15k_50k", "over_50k", "undecided"] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number];

export const COMM_CHANNELS = ["email", "slack", "phone", "video_call", "project_tool"] as const;
export type CommChannel = (typeof COMM_CHANNELS)[number];

export interface IntakeAnswers {
  business: { legalName: string; industry: string; targetAudience: string; usp: string };
  goals: { primaryObjective: PrimaryObjective; painPoints: string; successDefinition: string };
  branding: {
    hasBrandAssets: boolean;
    brandNotes: string;
    visualStyle: VisualStyle;
    inspirationLinks: string[];
  };
  technical: { features: string[]; contentOwner: string; domainStatus: DomainStatus; integrations: string };
  logistics: {
    targetLaunch: string;
    budgetRange: BudgetRange;
    dayToDayContact: string;
    finalApprover: string;
    commChannel: CommChannel;
    reviewTurnaround: string;
  };
  compliance: {
    jurisdictions: string[];
    dataCollected: string[];
    trackers: string;
    hasPrivacyPolicy: boolean;
  };
}

export interface OnboardingIntake {
  clientId: string;
  status: IntakeStatus;
  answers: IntakeAnswers;
  submittedAt: string | null;
  updatedAt: string | null;
}

const MAX_TEXT = 2000;
const MAX_SHORT = 200;
const MAX_LIST = 20;

function str(v: unknown, max = MAX_SHORT): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function bool(v: unknown): boolean {
  return v === true || v === "true";
}

function oneOf<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T[number]) : fallback;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((item) => str(item, MAX_SHORT))
    .filter((s) => s.length > 0)
    .slice(0, MAX_LIST);
}

/** Produces a clean, fully-typed intake object from arbitrary input. */
export function normalizeIntakeAnswers(raw: unknown): IntakeAnswers {
  const r = (raw ?? {}) as Record<string, Record<string, unknown>>;
  const business = r.business ?? {};
  const goals = r.goals ?? {};
  const branding = r.branding ?? {};
  const technical = r.technical ?? {};
  const logistics = r.logistics ?? {};
  const compliance = r.compliance ?? {};

  return {
    business: {
      legalName: str(business.legalName),
      industry: str(business.industry),
      targetAudience: str(business.targetAudience, MAX_TEXT),
      usp: str(business.usp, MAX_TEXT),
    },
    goals: {
      primaryObjective: oneOf(goals.primaryObjective, PRIMARY_OBJECTIVES, "generate_leads"),
      painPoints: str(goals.painPoints, MAX_TEXT),
      successDefinition: str(goals.successDefinition, MAX_TEXT),
    },
    branding: {
      hasBrandAssets: bool(branding.hasBrandAssets),
      brandNotes: str(branding.brandNotes, MAX_TEXT),
      visualStyle: oneOf(branding.visualStyle, VISUAL_STYLES, "professional"),
      inspirationLinks: strList(branding.inspirationLinks),
    },
    technical: {
      features: strList(technical.features),
      contentOwner: str(technical.contentOwner),
      domainStatus: oneOf(technical.domainStatus, DOMAIN_STATUSES, "unsure"),
      integrations: str(technical.integrations, MAX_TEXT),
    },
    logistics: {
      targetLaunch: str(logistics.targetLaunch),
      budgetRange: oneOf(logistics.budgetRange, BUDGET_RANGES, "undecided"),
      dayToDayContact: str(logistics.dayToDayContact),
      finalApprover: str(logistics.finalApprover),
      commChannel: oneOf(logistics.commChannel, COMM_CHANNELS, "email"),
      reviewTurnaround: str(logistics.reviewTurnaround),
    },
    compliance: {
      jurisdictions: strList(compliance.jurisdictions),
      dataCollected: strList(compliance.dataCollected),
      trackers: str(compliance.trackers, MAX_TEXT),
      hasPrivacyPolicy: bool(compliance.hasPrivacyPolicy),
    },
  };
}
