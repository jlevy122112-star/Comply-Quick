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
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "snapchat",
    name: "Snap Pixel",
    vendor: "Snap Inc.",
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "hotjar",
    name: "Hotjar",
    vendor: "Hotjar Ltd.",
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
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device", "identifiers"],
    triggersObligations: US_TRACKER_OBLIGATIONS,
  },
  {
    id: "clarity",
    name: "Microsoft Clarity",
    vendor: "Microsoft Corporation",
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
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    dpaUrl: "https://www.intercom.com/legal/data-processing-agreement",
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa"],
  },
  {
    id: "drift",
    name: "Drift",
    vendor: "Drift.com, Inc.",
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "online_activity"],
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa"],
  },
  {
    id: "segment",
    name: "Segment",
    vendor: "Twilio Inc.",
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
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["online_activity", "device"],
    dpaUrl: "https://www.datadoghq.com/legal/data-processing-addendum/",
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa"],
  },
  {
    id: "stripe",
    name: "Stripe",
    vendor: "Stripe, Inc.",
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
    role: "processor",
    vendorRegion: "us",
    dataCategories: ["identifiers", "financial"],
    triggersObligations: ["gdpr.art13.privacy_notice", "gdpr.art28.dpa", "pci_dss.saq_scope"],
  },
];

const CATALOG_INDEX: ReadonlyMap<string, ServiceCatalogEntry> = new Map(SERVICE_CATALOG.map((e) => [e.id, e]));

/** Returns the catalog entry for a detected service id, or undefined. */
export function getService(id: string): ServiceCatalogEntry | undefined {
  return CATALOG_INDEX.get(id);
}
