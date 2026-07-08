// Canonical, structured metadata for the compliance quick tools.
//
// This is the single source of truth the Cookie Consent Banner, DPA Template
// Builder, and Subprocessor Mapping tools all read from. Each tool *derives* its
// output from these tables rather than hardcoding per-tool copy, so adding a new
// tracking pixel or target region here automatically flows through every tool.
//
// The pixel/region keys are the same union types the ClauseEngine validates
// against, keeping the tools in lockstep with the compliance wizard.

import { TRACKING_PIXELS, TARGET_REGIONS, type TrackingPixel, type TargetRegion } from "@/components/ClauseEngine";

export { TRACKING_PIXELS, TARGET_REGIONS };
export type { TrackingPixel, TargetRegion };

/** How a jurisdiction expects consent to be collected before non-essential tracking. */
export type ConsentModel = "opt-in" | "opt-out" | "notice";

/** Cookie/consent categories a script can belong to. Essential is always allowed. */
export type ConsentCategory = "essential" | "analytics" | "advertising" | "functional";

export interface VendorMeta {
  /** Product / technology name, e.g. "Meta Pixel". */
  name: string;
  /** Legal entity that receives the data. */
  company: string;
  /** Consent category the script falls under (drives banner gating). */
  category: Exclude<ConsentCategory, "essential">;
  /** Plain-language purpose of the integration. */
  purpose: string;
  /** Categories of personal data transmitted to the vendor. */
  dataCategories: string[];
  /** Substring(s) matched against network/script URLs to detect the vendor. */
  scriptHosts: string[];
  /** Where an end user can opt out of the vendor's processing. */
  optOutUrl: string;
  /** Vendor privacy policy. */
  privacyPolicyUrl: string;
}

/** Structured vendor metadata keyed by the canonical tracking-pixel id. */
export const PIXEL_VENDORS: Record<TrackingPixel, VendorMeta> = {
  meta: {
    name: "Meta Pixel",
    company: "Meta Platforms, Inc.",
    category: "advertising",
    purpose: "Conversion tracking, audience building, and advertising optimization.",
    dataCategories: ["Page views", "Content interactions", "Add-to-cart & purchase events", "IP address"],
    scriptHosts: ["connect.facebook.net", "facebook.com/tr"],
    optOutUrl: "https://www.facebook.com/ads/preferences",
    privacyPolicyUrl: "https://www.facebook.com/privacy/policy",
  },
  google: {
    name: "Google Analytics / Google Ads",
    company: "Google LLC",
    category: "analytics",
    purpose: "Website analytics, conversion tracking, and remarketing.",
    dataCategories: ["Session activity", "Device information", "Approximate location", "Referral source"],
    scriptHosts: ["googletagmanager.com", "google-analytics.com", "googleadservices.com"],
    optOutUrl: "https://adssettings.google.com",
    privacyPolicyUrl: "https://policies.google.com/privacy",
  },
  tiktok: {
    name: "TikTok Pixel",
    company: "ByteDance Ltd.",
    category: "advertising",
    purpose: "Ad conversion measurement and custom-audience creation.",
    dataCategories: ["Page views", "Button clicks", "Form submissions", "Purchase events"],
    scriptHosts: ["analytics.tiktok.com"],
    optOutUrl: "https://www.tiktok.com/legal/page/row/privacy-policy/en",
    privacyPolicyUrl: "https://www.tiktok.com/legal/page/row/privacy-policy/en",
  },
  linkedin: {
    name: "LinkedIn Insight Tag",
    company: "LinkedIn Corporation (Microsoft)",
    category: "advertising",
    purpose: "Conversion tracking, website retargeting, and audience analytics.",
    dataCategories: ["Page views", "URL metadata", "Anonymized IP", "Professional demographics"],
    scriptHosts: ["snap.licdn.com", "px.ads.linkedin.com"],
    optOutUrl: "https://www.linkedin.com/psettings/guest-controls/retargeting-opt-out",
    privacyPolicyUrl: "https://www.linkedin.com/legal/privacy-policy",
  },
  pinterest: {
    name: "Pinterest Tag",
    company: "Pinterest, Inc.",
    category: "advertising",
    purpose: "Conversion measurement, retargeting, and ad optimization.",
    dataCategories: ["Page visits", "Add-to-cart events", "Checkout events", "Search queries"],
    scriptHosts: ["ct.pinterest.com", "s.pinimg.com"],
    optOutUrl: "https://www.pinterest.com/settings/privacy-and-data",
    privacyPolicyUrl: "https://policy.pinterest.com/privacy-policy",
  },
  snapchat: {
    name: "Snap Pixel",
    company: "Snap Inc.",
    category: "advertising",
    purpose: "Conversion tracking and lookalike-audience generation.",
    dataCategories: ["Page views", "Form submissions", "Purchase events", "Engagement signals"],
    scriptHosts: ["sc-static.net", "tr.snapchat.com"],
    optOutUrl: "https://accounts.snapchat.com/accounts/downgrade",
    privacyPolicyUrl: "https://snap.com/privacy/privacy-policy",
  },
};

export interface RegionMeta {
  /** Short display name, e.g. "EU / EEA (GDPR)". */
  name: string;
  /** Statute short name. */
  law: string;
  /** Consent model the jurisdiction expects for non-essential tracking. */
  consentModel: ConsentModel;
  /** Supervisory/enforcement authority. */
  authority: string;
  /** Whether an explicit "Do Not Sell/Share" control is expected (CCPA/CPRA). */
  requiresDoNotSell: boolean;
}

/** Structured jurisdiction metadata keyed by the canonical region id. */
export const REGION_RULES: Record<TargetRegion, RegionMeta> = {
  us_general: {
    name: "United States (General)",
    law: "US State Privacy Laws",
    consentModel: "notice",
    authority: "State Attorneys General",
    requiresDoNotSell: false,
  },
  california_ccpa: {
    name: "California (CCPA/CPRA)",
    law: "CCPA/CPRA",
    consentModel: "opt-out",
    authority: "California Privacy Protection Agency",
    requiresDoNotSell: true,
  },
  eu_gdpr: {
    name: "EU / EEA / UK (GDPR)",
    law: "GDPR",
    consentModel: "opt-in",
    authority: "Data Protection Supervisory Authorities",
    requiresDoNotSell: false,
  },
  canada_pipeda: {
    name: "Canada (PIPEDA)",
    law: "PIPEDA",
    consentModel: "opt-in",
    authority: "Office of the Privacy Commissioner of Canada",
    requiresDoNotSell: false,
  },
  brazil_lgpd: {
    name: "Brazil (LGPD)",
    law: "LGPD",
    consentModel: "opt-in",
    authority: "Autoridade Nacional de Proteção de Dados (ANPD)",
    requiresDoNotSell: false,
  },
  australia_privacy: {
    name: "Australia (Privacy Act 1988)",
    law: "Australian Privacy Principles",
    consentModel: "opt-out",
    authority: "Office of the Australian Information Commissioner (OAIC)",
    requiresDoNotSell: false,
  },
};

/** Strictness ordering used to pick the governing consent model across regions. */
const CONSENT_STRICTNESS: Record<ConsentModel, number> = { "opt-in": 3, "opt-out": 2, notice: 1 };

/**
 * Given a set of target regions, returns the strictest consent model that
 * satisfies all of them (opt-in > opt-out > notice). Empty input defaults to
 * the most protective model so the generated banner is never under-compliant.
 */
export function governingConsentModel(regions: TargetRegion[]): ConsentModel {
  if (regions.length === 0) return "opt-in";
  return regions.reduce<ConsentModel>((strictest, region) => {
    const model = REGION_RULES[region].consentModel;
    return CONSENT_STRICTNESS[model] > CONSENT_STRICTNESS[strictest] ? model : strictest;
  }, "notice");
}

/** True when any selected region requires an explicit Do-Not-Sell/Share control. */
export function requiresDoNotSell(regions: TargetRegion[]): boolean {
  return regions.some((r) => REGION_RULES[r].requiresDoNotSell);
}
