// Service-to-obligation catalog (accuracy engine — phase 2).
//
// Maps each detectable third-party service (keyed by the scanner's fingerprint
// id) to a canonical entry: the vendor, its processing role, the data
// categories it touches, its DPA URL, and — critically — the obligation-graph
// node ids the service triggers. This is the deterministic bridge from "what we
// detected on the site" to "what the law therefore requires".

import type { DataCategory } from "./graph";

/** A processing role in data-protection terms. */
export type ProcessingRole = "processor" | "sub_processor" | "controller" | "joint_controller";

export interface ServiceCatalogEntry {
  /** Matches the scanner fingerprint id (see scanner/analyzer FINGERPRINTS). */
  id: string;
  name: string;
  vendor: string;
  role: ProcessingRole;
  /** Where the vendor is primarily established (drives transfer analysis). */
  vendorRegion: "us" | "eu" | "global";
  dataCategories: DataCategory[];
  /**
   * Whether this service is a consent-gated behavioral tracker under
   * GDPR/ePrivacy best practice. This is an EXPLICIT decision decoupled from
   * `dataCategories`: pure error/crash monitoring (e.g. Sentry) touches
   * `online_activity`-shaped data for diagnostics but does not perform
   * behavioral session tracking, so it is NOT consent-gated. Behavioral
   * trackers (analytics, ad pixels, session replay, RUM, CDPs) are. This
   * mirrors the scanner's category-based exclusion of `error_monitoring`
   * (see scanner/analyzer.ts). `chat` widgets (Intercom, Drift) ARE
   * consent-gated: they load on page-load and set persistent identifying
   * cookies before any interaction, beyond "strictly necessary" under ePrivacy
   * Art. 5(3) — the scanner includes `chat` in its tracker set to match.
   */
  consentGated: boolean;
  /** Canonical DPA URL for the vendor, when one is published. */
  dpaUrl?: string;
  /** Obligation node ids this service triggers (see graph.OBLIGATION_NODES). */
  triggersObligations: string[];
}

// A US-based analytics/advertising processor triggers this core set: privacy
// notice, prior consent, a DPA, and the US privacy-law notices. Cross-border
// transfer safeguards (Art. 46) are NOT listed here — they are derived in the
// traversal engine from each vendor's region, so the obligation only appears
// when EU/UK data actually leaves the EEA.
const US_TRACKER_OBLIGATIONS = [
  "gdpr.art13.privacy_notice",
  "gdpr.art7.consent",
  "gdpr.art28.dpa",
  "ccpa.notice_at_collection",
  "cpra.opt_out_sale_share",
];

// A non-tracker processor (payment gateway, tag container, consent CMP, error
// monitor) is not consent-gated, but its presence still means personal data is
// disclosed to a third party — so it must be named in the privacy notice and
// covered by a DPA. It does NOT trigger Art. 7 consent or the CCPA/CPRA
// sale/share notices, which are specific to behavioral tracking.
const PROCESSOR_DISCLOSURE_OBLIGATIONS = ["gdpr.art13.privacy_notice", "gdpr.art28.dpa"];

// A joint controller (e.g. Meta Pixel, per CJEU C-40/17 Fashion ID) requires an
// Art. 26 joint-controller arrangement rather than an Art. 28 processor DPA.
const US_JOINT_CONTROLLER_OBLIGATIONS = [
  "gdpr.art13.privacy_notice",
  "gdpr.art7.consent",
  "gdpr.art26.joint_controller",
  "ccpa.notice_at_collection",
  "cpra.opt_out_sale_share",
];

export const SERVICE_CATALOG: readonly ServiceCatalogEntry[] = [
  {
    id: "google",
    name: "Google Analytics / Ads",
    vendor: "Google LLC",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity", "device", "location"],
    dpaUrl: "https://business.safety.google/adsprocessorterms/",
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "meta",
    name: "Meta Pixel",
    vendor: "Meta Platforms, Inc.",
    consentGated: true,
    role: "joint_controller",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity", "device"],
    dpaUrl: "https://www.facebook.com/legal/terms/dataprocessing",
    triggersObligations: US_JOINT_CONTROLLER_OBLIGATIONS,
  },
  {
    id: "tiktok",
    name: "TikTok Pixel",
    vendor: "TikTok Technology Ltd.",
    consentGated: true,
    role: "processor",
    vendorRegion: "global",
    dataCategories: ["identifiers", "online_activity", "device"],
    dpaUrl: "https://ads.tiktok.com/i18n/official/policy/business-products-data-processing-agreement",
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "linkedin",
    name: "LinkedIn Insight",
    vendor: "LinkedIn Corporation (Microsoft)",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity", "device"],
    dpaUrl: "https://legal.linkedin.com/dpa",
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "pinterest",
    name: "Pinterest Tag",
    vendor: "Pinterest, Inc.",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "snapchat",
    name: "Snap Pixel",
    vendor: "Snap Inc.",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "hotjar",
    name: "Hotjar",
    vendor: "Hotjar Ltd.",
    consentGated: true,
    role: "processor",
    vendorRegion: "eu",
    dataCategories: ["online_activity", "device"],
    dpaUrl: "https://www.hotjar.com/legal/support/dpa/",
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art7.consent", "gdpr.art28.dpa"],
  },
  {
    id: "fullstory",
    name: "FullStory",
    vendor: "FullStory, Inc.",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device", "identifiers"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "clarity",
    name: "Microsoft Clarity",
    vendor: "Microsoft Corporation",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device"],
    dpaUrl:
      "https://www.microsoft.com/licensing/docs/view/Microsoft-Products-and-Services-Data-Protection-Addendum-DPA",
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "intercom",
    name: "Intercom",
    vendor: "Intercom, Inc.",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    dpaUrl: "https://www.intercom.com/legal/data-processing-agreement",
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "drift",
    name: "Drift",
    vendor: "Drift.com, Inc.",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "segment",
    name: "Segment",
    vendor: "Twilio Inc.",
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity", "device"],
    dpaUrl: "https://www.twilio.com/en-us/legal/data-protection-addendum",
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "sentry",
    name: "Sentry",
    vendor: "Functional Software, Inc.",
    // Pure error/crash monitoring — diagnostics, not behavioral tracking.
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device", "identifiers"],
    dpaUrl: "https://sentry.io/legal/dpa/",
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa"],
  },
  {
    id: "datadog",
    name: "Datadog RUM",
    vendor: "Datadog, Inc.",
    // Real-user monitoring performs behavioral session tracking.
    consentGated: true,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device"],
    dpaUrl: "https://www.datadoghq.com/legal/data-processing-addendum/",
    // A US-based, consent-gated behavioral tracker: use the shared tracker
    // obligation set (privacy notice + Art. 7 consent + DPA + CCPA/CPRA notices)
    // so it matches every other US behavioral tracker and the traversal engine
    // derives the same consent requirement the linter enforces.
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "stripe",
    name: "Stripe",
    vendor: "Stripe, Inc.",
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "financial"],
    dpaUrl: "https://stripe.com/legal/dpa",
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa", "pci_dss.saq_scope"],
  },
  {
    id: "paypal",
    name: "PayPal",
    vendor: "PayPal Holdings, Inc.",
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "financial"],
    dpaUrl: "https://www.paypal.com/us/legalhub/paypal/data-protection-agreement-full",
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa", "pci_dss.saq_scope"],
  },
  {
    id: "square",
    name: "Square",
    vendor: "Block, Inc.",
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "financial"],
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa", "pci_dss.saq_scope"],
  },
  {
    id: "gtm",
    name: "Google Tag Manager",
    vendor: "Google LLC",
    // A tag container, not itself a behavioral tracker: loading GTM does not by
    // itself set tracking cookies, so it is not consent-gated. The tags it
    // deploys are detected and gated on their own merits.
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device"],
    dpaUrl: "https://business.safety.google/adsprocessorterms/",
    triggersObligations: PROCESSOR_DISCLOSURE_OBLIGATIONS,
  },
  {
    id: "cookiebot",
    name: "Cookiebot",
    vendor: "Cybot A/S",
    // A consent management platform — the compliance control itself, not a
    // tracker. Runs before consent as strictly necessary.
    consentGated: false,
    role: "processor",
    vendorRegion: "eu",
    dataCategories: ["identifiers"],
    dpaUrl: "https://www.cookiebot.com/en/data-processing-agreement/",
    triggersObligations: PROCESSOR_DISCLOSURE_OBLIGATIONS,
  },
  {
    id: "onetrust",
    name: "OneTrust",
    vendor: "OneTrust, LLC",
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers"],
    dpaUrl: "https://www.onetrust.com/dpa/",
    triggersObligations: PROCESSOR_DISCLOSURE_OBLIGATIONS,
  },
  {
    id: "termly",
    name: "Termly",
    vendor: "Termly, Inc.",
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers"],
    triggersObligations: PROCESSOR_DISCLOSURE_OBLIGATIONS,
  },
  {
    id: "osano",
    name: "Osano",
    vendor: "Osano, Inc.",
    consentGated: false,
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers"],
    triggersObligations: PROCESSOR_DISCLOSURE_OBLIGATIONS,
  },
];

const CATALOG_INDEX: ReadonlyMap<string, ServiceCatalogEntry> = new Map(SERVICE_CATALOG.map((e) => [e.id, e]));

/** Returns the catalog entry for a detected service id, or undefined. */
export function getService(id: string): ServiceCatalogEntry | undefined {
  return CATALOG_INDEX.get(id);
}
