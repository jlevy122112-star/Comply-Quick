// Compliance context graph (accuracy engine — phase 2).
//
// Accuracy comes from a structured norm graph (frameworks → obligations →
// evidence patterns), not from LLM "vibes". This module is a pure,
// dependency-free, deterministic data structure: every obligation node carries
// its framework, statutory reference, the jurisdictions it applies in, the
// evidence that satisfies it, and a provenance record pointing at the official
// source with a version timestamp. Downstream code (traversal, generation,
// linting) treats this graph as the single source of truth.

export type FrameworkId =
  | "gdpr"
  | "ccpa"
  | "cpra"
  | "vcdpa"
  | "cpa"
  | "ctdpa"
  | "tdpsa"
  | "ucpa"
  | "coppa"
  | "can_spam"
  | "lgpd"
  | "hipaa"
  | "pci_dss"
  | "soc2"
  | "iso27001"
  | "eu_ai_act"
  | "pipeda";

export type JurisdictionId =
  | "eu"
  | "uk"
  | "us_general"
  | "us_ca"
  | "us_va"
  | "us_co"
  | "us_ct"
  | "us_tx"
  | "us_ut"
  | "br"
  | "ca"
  | "au"
  | "global";

export type DataCategory =
  | "identifiers"
  | "online_activity"
  | "device"
  | "location"
  | "financial"
  | "health"
  | "biometric"
  | "children"
  | "email";

export type ObligationSeverity = "critical" | "warning" | "info";

/** Where an obligation node's text/authority comes from, with a version stamp. */
export interface Provenance {
  /** Official body or corpus, e.g. "EUR-Lex", "California OAG", "NIST", "PCI SSC". */
  source: string;
  /** Canonical URL of the source text. */
  url: string;
  /** ISO date the referenced source/version was last verified. */
  lastUpdated: string;
}

/**
 * A single, traceable compliance obligation.
 *
 * `id` is a stable dotted path (framework.reference.slug) used everywhere the
 * obligation is referenced (traversal paths, document citations, lint findings).
 */
export interface ObligationNode {
  id: string;
  framework: FrameworkId;
  /** Statutory / control reference, e.g. "Art. 28(3)", "§ 1798.100", "CC6.1". */
  reference: string;
  title: string;
  /** Plain-language statement of what must be done. */
  obligation: string;
  /** Evidence patterns that satisfy the obligation (feeds the evidence pack). */
  evidence: string[];
  /** Jurisdictions in which this obligation applies. */
  jurisdictions: JurisdictionId[];
  severity: ObligationSeverity;
  provenance: Provenance;
  /** True when applicability requires an input the public scan cannot prove. */
  conditional?: boolean;
}

const EURLEX = (celex: string): string => `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;
const VIRGINIA_VCDPA = "https://law.lis.virginia.gov/vacode/title59.1/chapter53.1/";
const COLORADO_CPA = "https://leg.colorado.gov/bills/sb21-190";
const CONNECTICUT_CTDPA = "https://www.cga.ct.gov/2022/ACT/PA/PDF/2022PA-00015-R00SB-00006-PA.PDF";
const TEXAS_TDPSA = "https://statutes.capitol.texas.gov/Docs/BC/htm/BC.541.htm";
const UTAH_UCPA = "https://le.utah.gov/~2022/bills/static/SB0227.html";
const COPPA = "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-312";
const CAN_SPAM = "https://www.govinfo.gov/content/pkg/USCODE-2023-title15/html/USCODE-2023-title15-chap103.htm";

const US_STATE_OBLIGATION_NODES: readonly ObligationNode[] = [
  {
    id: "vcdpa.privacy_notice",
    framework: "vcdpa",
    reference: "Va. Code § 59.1-574(A)(1)",
    title: "Virginia privacy notice",
    obligation:
      "Provide Virginia consumers with a reasonably accessible privacy notice describing the categories and purposes of personal-data processing.",
    evidence: ["Published privacy policy", "Category-to-purpose mapping"],
    jurisdictions: ["us_va"],
    severity: "critical",
    provenance: { source: "Virginia Code", url: VIRGINIA_VCDPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "vcdpa.opt_out_targeted_advertising",
    framework: "vcdpa",
    reference: "Va. Code § 59.1-573(A)(5)",
    title: "Virginia targeted-advertising opt-out",
    obligation:
      "Provide a mechanism for Virginia consumers to opt out of targeted advertising and profiling in furtherance of consequential decisions.",
    evidence: ["Targeted-advertising opt-out control", "Opt-out request handling"],
    jurisdictions: ["us_va"],
    severity: "critical",
    provenance: { source: "Virginia Code", url: VIRGINIA_VCDPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "cpa.privacy_notice",
    framework: "cpa",
    reference: "Colo. Rev. Stat. § 6-1-1308",
    title: "Colorado privacy notice",
    obligation:
      "Provide Colorado consumers with a reasonably accessible notice describing personal-data categories, purposes, rights, and disclosures.",
    evidence: ["Published privacy policy", "Category-to-purpose mapping"],
    jurisdictions: ["us_co"],
    severity: "critical",
    provenance: { source: "Colorado Revised Statutes", url: COLORADO_CPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "cpa.opt_out_targeted_advertising",
    framework: "cpa",
    reference: "Colo. Rev. Stat. § 6-1-1306",
    title: "Colorado targeted-advertising opt-out",
    obligation:
      "Honor Colorado consumer opt-out rights for targeted advertising, sale of personal data, and certain profiling.",
    evidence: ["Opt-out link or preference center", "Targeted-advertising and profiling controls"],
    jurisdictions: ["us_co"],
    severity: "critical",
    provenance: { source: "Colorado Revised Statutes", url: COLORADO_CPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "cpa.universal_opt_out",
    framework: "cpa",
    reference: "Colo. Rev. Stat. § 6-1-1306",
    title: "Colorado universal opt-out signal",
    obligation:
      "Honor a recognized universal opt-out mechanism, including applicable Global Privacy Control signals, for Colorado consumers.",
    evidence: ["GPC/universal opt-out signal handling", "Signal-to-preference audit record"],
    jurisdictions: ["us_co"],
    severity: "critical",
    provenance: { source: "Colorado Revised Statutes", url: COLORADO_CPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "ctdpa.privacy_notice",
    framework: "ctdpa",
    reference: "Conn. Gen. Stat. § 42-515e",
    title: "Connecticut privacy notice",
    obligation:
      "Provide Connecticut consumers with a clear privacy notice describing personal-data processing, disclosures, and consumer rights.",
    evidence: ["Published privacy policy", "Category-to-purpose mapping"],
    jurisdictions: ["us_ct"],
    severity: "critical",
    provenance: { source: "Connecticut General Statutes", url: CONNECTICUT_CTDPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "ctdpa.opt_out_targeted_advertising",
    framework: "ctdpa",
    reference: "Conn. Gen. Stat. § 42-515d",
    title: "Connecticut targeted-advertising opt-out",
    obligation:
      "Honor Connecticut consumer opt-out rights for targeted advertising, sale of personal data, and profiling.",
    evidence: ["Opt-out link or preference center", "Targeted-advertising and profiling controls"],
    jurisdictions: ["us_ct"],
    severity: "critical",
    provenance: { source: "Connecticut General Statutes", url: CONNECTICUT_CTDPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "ctdpa.universal_opt_out",
    framework: "ctdpa",
    reference: "Conn. Gen. Stat. § 42-515d",
    title: "Connecticut universal opt-out signal",
    obligation:
      "Honor applicable universal opt-out mechanisms, including Global Privacy Control signals, for Connecticut consumers.",
    evidence: ["GPC/universal opt-out signal handling", "Signal-to-preference audit record"],
    jurisdictions: ["us_ct"],
    severity: "critical",
    provenance: { source: "Connecticut General Statutes", url: CONNECTICUT_CTDPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "tdpsa.privacy_notice",
    framework: "tdpsa",
    reference: "Tex. Bus. & Com. Code § 541.101",
    title: "Texas privacy notice",
    obligation:
      "Provide Texas consumers with a reasonably accessible privacy notice describing personal-data categories, purposes, disclosures, and rights.",
    evidence: ["Published privacy policy", "Category-to-purpose mapping"],
    jurisdictions: ["us_tx"],
    severity: "critical",
    provenance: { source: "Texas Business and Commerce Code", url: TEXAS_TDPSA, lastUpdated: "2026-07-23" },
  },
  {
    id: "tdpsa.opt_out_targeted_advertising",
    framework: "tdpsa",
    reference: "Tex. Bus. & Com. Code § 541.051",
    title: "Texas targeted-advertising opt-out",
    obligation:
      "Honor Texas consumer opt-out rights for targeted advertising, sale of personal data, and certain profiling.",
    evidence: ["Opt-out link or preference center", "Targeted-advertising and profiling controls"],
    jurisdictions: ["us_tx"],
    severity: "critical",
    provenance: { source: "Texas Business and Commerce Code", url: TEXAS_TDPSA, lastUpdated: "2026-07-23" },
  },
  {
    id: "ucpa.privacy_notice",
    framework: "ucpa",
    reference: "Utah Code § 13-61-302",
    title: "Utah privacy notice",
    obligation:
      "Provide Utah consumers with a clear privacy notice describing personal-data processing and consumer rights.",
    evidence: ["Published privacy policy", "Category-to-purpose mapping"],
    jurisdictions: ["us_ut"],
    severity: "critical",
    provenance: { source: "Utah Code", url: UTAH_UCPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "ucpa.opt_out_targeted_advertising",
    framework: "ucpa",
    reference: "Utah Code § 13-61-201",
    title: "Utah targeted-advertising opt-out",
    obligation: "Honor Utah consumer opt-out rights for targeted advertising and sale of personal data.",
    evidence: ["Opt-out link or preference center", "Targeted-advertising control"],
    jurisdictions: ["us_ut"],
    severity: "critical",
    provenance: { source: "Utah Code", url: UTAH_UCPA, lastUpdated: "2026-07-23" },
  },
];

const FEDERAL_OBLIGATION_NODES: readonly ObligationNode[] = [
  {
    id: "coppa.child_directed_privacy",
    framework: "coppa",
    reference: "16 C.F.R. §§ 312.4-312.5",
    title: "Children's privacy notice and parental consent",
    obligation:
      "If the service is child-directed or knowingly collects children's personal information, provide the required notice and obtain verifiable parental consent before collection.",
    evidence: ["Child-directed audience assessment", "COPPA privacy notice", "Verifiable parental-consent records"],
    jurisdictions: ["us_general"],
    severity: "critical",
    conditional: true,
    provenance: { source: "Electronic Code of Federal Regulations", url: COPPA, lastUpdated: "2026-07-23" },
  },
  {
    id: "can_spam.commercial_email",
    framework: "can_spam",
    reference: "15 U.S.C. § 7704",
    title: "Commercial email identification and opt-out",
    obligation:
      "For commercial email programs, use accurate header and subject information, identify the message as an advertisement where required, include a physical postal address, and honor opt-out requests.",
    evidence: [
      "Commercial-email compliance checklist",
      "Unsubscribe mechanism",
      "Sender identity and postal-address review",
    ],
    jurisdictions: ["us_general"],
    severity: "warning",
    provenance: { source: "U.S. Government Publishing Office", url: CAN_SPAM, lastUpdated: "2026-07-23" },
  },
];

// Curated, cited obligation corpus. Intentionally not exhaustive; every node is
// backed by an official source and can be expanded without touching consumers.
export const OBLIGATION_NODES: readonly ObligationNode[] = [
  ...US_STATE_OBLIGATION_NODES,
  ...FEDERAL_OBLIGATION_NODES,
  {
    id: "gdpr.art13.privacy_notice",
    framework: "gdpr",
    reference: "Art. 13-14",
    title: "Transparent privacy notice",
    obligation:
      "Provide data subjects with a clear privacy notice covering identity of the controller, purposes and legal bases of processing, recipients, retention, transfers, and their rights.",
    evidence: ["Published privacy policy linked site-wide", "Legal-basis table per processing purpose"],
    jurisdictions: ["eu", "uk"],
    severity: "critical",
    provenance: { source: "EUR-Lex", url: EURLEX("32016R0679"), lastUpdated: "2024-01-01" },
  },
  {
    id: "gdpr.art7.consent",
    framework: "gdpr",
    reference: "Art. 7 & Recital 32",
    title: "Freely given, prior consent for non-essential cookies/trackers",
    obligation:
      "Obtain unambiguous, prior opt-in consent before setting non-essential cookies or loading tracking/advertising scripts; make withdrawal as easy as granting.",
    evidence: ["Consent Management Platform that blocks scripts pre-consent", "Consent logs with timestamp"],
    jurisdictions: ["eu", "uk"],
    severity: "critical",
    provenance: { source: "EUR-Lex", url: EURLEX("32016R0679"), lastUpdated: "2024-01-01" },
  },
  {
    id: "gdpr.art28.dpa",
    framework: "gdpr",
    reference: "Art. 28(3)",
    title: "Data Processing Agreement with each processor",
    obligation:
      "Enter a written Data Processing Agreement (DPA) with every processor that processes personal data on your behalf, binding them to documented instructions and security obligations.",
    evidence: ["Signed DPA per processor", "Sub-processor register"],
    jurisdictions: ["eu", "uk"],
    severity: "critical",
    provenance: { source: "EUR-Lex", url: EURLEX("32016R0679"), lastUpdated: "2024-01-01" },
  },
  {
    id: "gdpr.art26.joint_controller",
    framework: "gdpr",
    reference: "Art. 26",
    title: "Joint controller arrangement",
    obligation:
      "Where you jointly determine the purposes and means of processing with a partner (e.g. an advertising pixel that sets its own cookies), put a joint-controller arrangement in place and make its essence available to data subjects.",
    evidence: ["Signed joint-controller addendum", "Essence of the arrangement disclosed in the privacy notice"],
    jurisdictions: ["eu", "uk"],
    severity: "critical",
    provenance: { source: "EUR-Lex", url: EURLEX("32016R0679"), lastUpdated: "2024-01-01" },
  },
  {
    id: "gdpr.art46.transfers",
    framework: "gdpr",
    reference: "Art. 46 & SCCs",
    title: "Safeguards for international data transfers",
    obligation:
      "When personal data is transferred outside the EEA to a country without an adequacy decision, put appropriate safeguards in place (Standard Contractual Clauses) and run a transfer impact assessment.",
    evidence: ["Executed SCC module with each importer", "Transfer Impact Assessment record"],
    jurisdictions: ["eu", "uk"],
    severity: "critical",
    provenance: { source: "EUR-Lex", url: EURLEX("32021D0914"), lastUpdated: "2024-01-01" },
  },
  {
    id: "ccpa.notice_at_collection",
    framework: "ccpa",
    reference: "Cal. Civ. Code § 1798.100",
    title: "Notice at collection",
    obligation:
      "Inform California consumers at or before collection of the categories of personal information collected and the purposes for which they are used.",
    evidence: ["Notice-at-collection block in privacy policy", "Category-to-purpose mapping"],
    jurisdictions: ["us_ca"],
    severity: "critical",
    provenance: {
      source: "California Legislative Information",
      url: "https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?division=3.&part=4.&lawCode=CIV&title=1.81.5",
      lastUpdated: "2024-01-01",
    },
  },
  {
    id: "cpra.opt_out_sale_share",
    framework: "cpra",
    reference: "Cal. Civ. Code § 1798.135",
    title: "Do Not Sell or Share opt-out",
    obligation:
      'Provide a clear "Do Not Sell or Share My Personal Information" mechanism and honor Global Privacy Control signals when advertising/analytics trackers share personal information.',
    evidence: ["Opt-out link in footer", "GPC signal handling"],
    jurisdictions: ["us_ca"],
    severity: "critical",
    provenance: {
      source: "California Privacy Protection Agency",
      url: "https://cppa.ca.gov/regulations/",
      lastUpdated: "2024-01-01",
    },
  },
  {
    id: "lgpd.legal_basis",
    framework: "lgpd",
    reference: "LGPD Art. 7-9",
    title: "Legal basis and transparency (Brazil)",
    obligation:
      "Process personal data of individuals in Brazil only on a valid legal basis and provide clear information about processing purposes and data-subject rights.",
    evidence: ["Portuguese-language privacy notice", "Legal-basis record"],
    jurisdictions: ["br"],
    severity: "warning",
    provenance: {
      source: "Planalto (Lei nº 13.709/2018)",
      url: "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
      lastUpdated: "2024-01-01",
    },
  },
  {
    id: "pci_dss.saq_scope",
    framework: "pci_dss",
    reference: "PCI DSS v4.0 Req. 3 & 12",
    title: "Cardholder data handling & SAQ",
    obligation:
      "When accepting card payments, minimize cardholder-data scope (prefer a hosted/redirect or tokenized flow), maintain the applicable Self-Assessment Questionnaire, and document the payment data flow.",
    evidence: ["Completed SAQ (A / A-EP as scoped)", "Payment data-flow diagram"],
    jurisdictions: ["global"],
    severity: "warning",
    provenance: {
      source: "PCI Security Standards Council",
      url: "https://www.pcisecuritystandards.org/document_library/",
      lastUpdated: "2024-01-01",
    },
  },
  {
    id: "eu_ai_act.deployer_transparency",
    framework: "eu_ai_act",
    reference: "EU AI Act Art. 50",
    title: "AI transparency toward end users",
    obligation:
      "When deploying an AI system that interacts with end users or generates content, disclose that users are interacting with / viewing AI-generated output.",
    evidence: ["AI-interaction disclosure in UI", "AI deployer statement"],
    jurisdictions: ["eu"],
    severity: "warning",
    provenance: { source: "EUR-Lex", url: EURLEX("32024R1689"), lastUpdated: "2024-08-01" },
  },
  {
    id: "soc2.cc6_1.access",
    framework: "soc2",
    reference: "TSC CC6.1",
    title: "Logical access controls",
    obligation:
      "Implement logical access-security controls (authentication, authorization, least privilege) protecting information assets against unauthorized access.",
    evidence: ["Access-control policy", "RBAC configuration export", "Access review records"],
    jurisdictions: ["global"],
    severity: "info",
    provenance: {
      source: "AICPA Trust Services Criteria",
      url: "https://www.aicpa-cima.com/resources/download/2017-trust-services-criteria-with-revised-points-of-focus-2022",
      lastUpdated: "2022-01-01",
    },
  },
];

const NODE_INDEX: ReadonlyMap<string, ObligationNode> = new Map(OBLIGATION_NODES.map((n) => [n.id, n]));

/** Returns the obligation node for an id, or undefined if unknown. */
export function getObligation(id: string): ObligationNode | undefined {
  return NODE_INDEX.get(id);
}

/** Returns the obligation nodes for the given ids, skipping any that are unknown. */
export function getObligations(ids: readonly string[]): ObligationNode[] {
  const out: ObligationNode[] = [];
  for (const id of ids) {
    const node = NODE_INDEX.get(id);
    if (node) out.push(node);
  }
  return out;
}
