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
  "gdpr" | "ccpa" | "cpra" | "lgpd" | "hipaa" | "pci_dss" | "soc2" | "iso27001" | "eu_ai_act" | "pipeda";

export type JurisdictionId = "eu" | "uk" | "us_general" | "us_ca" | "br" | "ca" | "au" | "global";

export type DataCategory =
  "identifiers" | "online_activity" | "device" | "location" | "financial" | "health" | "biometric" | "children";

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
}

const EURLEX = (celex: string): string => `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${celex}`;

// Curated, cited obligation corpus. Intentionally not exhaustive; every node is
// backed by an official source and can be expanded without touching consumers.
export const OBLIGATION_NODES: readonly ObligationNode[] = [
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
