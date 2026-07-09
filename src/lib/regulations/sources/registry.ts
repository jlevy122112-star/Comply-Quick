// Official regulatory-source registry.
//
// Single source of truth for *where* each regulation's authoritative text comes
// from — the issuing agency and its official government/standards URL. The
// ingestion pipeline (`src/services/regulation_ingestion.ts`) and the monitoring
// agent read this registry, so nothing in the app is transcribed from memory.
//
// Coverage goal: EVERY appropriate agency for Comply-Quick's target industries,
// not a handful. Each source declares a `monitorMode`:
//   - "structured": the agency publishes machine-readable text (eCFR JSON, NIST
//     OSCAL, EUR-Lex, CA leginfo) → we ingest full normative text.
//   - "source_watch": no machine-readable feed and/or licensed text → the agent
//     still fetches the official page and hashes it to detect real-world changes
//     and alert the user; we cite the source rather than reproduce its text.
//
// Licensing: U.S. government works (eCFR, NIST, FTC), EU (EUR-Lex, reused under
// the Commission reuse notice with attribution), and California statute are
// public-domain / freely reusable, so we may ingest and store their text.
// Private standards bodies (AICPA, ISO, PCI SSC) license their control text, so
// those are `source_watch` + reference-only.

export type SourceLicense = "public_domain" | "eu_reuse" | "proprietary";
export type SourceFormat = "ecfr_json" | "oscal_json" | "html" | "reference_only";
export type MonitorMode = "structured" | "source_watch";

export type RegulationCategory =
  "privacy" | "security" | "payments" | "health" | "consumer_protection" | "marketing" | "ai" | "financial";

export interface RegulationSource {
  framework: string;
  label: string;
  /** The agency/body that issues and maintains the regulation. */
  institution: string;
  jurisdiction: string;
  category: RegulationCategory;
  officialUrl: string;
  /** Endpoint the agent fetches (machine feed for structured; official page otherwise). */
  ingestUrl: string;
  license: SourceLicense;
  format: SourceFormat;
  monitorMode: MonitorMode;
  /** Whether we ingest full normative text (public-domain machine feeds only). */
  ingestFullText: boolean;
}

// The comprehensive list. `as const` gives us a precise union of framework ids.
export const REGULATION_SOURCE_LIST = [
  // ── US federal: health ──────────────────────────────────────────────────────
  {
    framework: "hipaa",
    label: "HIPAA Security & Privacy Rules",
    institution: "U.S. Department of Health & Human Services (HHS / OCR)",
    jurisdiction: "United States",
    category: "health",
    officialUrl: "https://www.hhs.gov/hipaa/for-professionals/security/index.html",
    ingestUrl: "https://www.ecfr.gov/api/versioner/v1/structure/current/title-45.json",
    license: "public_domain",
    format: "ecfr_json",
    monitorMode: "structured",
    // eCFR structure endpoint yields section IDs/titles only (no prose), so we
    // ingest reference controls + detect structural change, not full text yet.
    ingestFullText: false,
  },
  {
    framework: "hitech",
    label: "HITECH Act (Breach Notification)",
    institution: "U.S. Department of Health & Human Services (HHS / OCR)",
    jurisdiction: "United States",
    category: "health",
    officialUrl: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
    ingestUrl: "https://www.hhs.gov/hipaa/for-professionals/breach-notification/index.html",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  // ── US federal: consumer protection / privacy / marketing (FTC) ──────────────
  {
    framework: "ftc_act_5",
    label: "FTC Act §5 (Unfair/Deceptive Practices)",
    institution: "U.S. Federal Trade Commission (FTC)",
    jurisdiction: "United States",
    category: "consumer_protection",
    officialUrl: "https://www.ftc.gov/legal-library/browse/statutes/federal-trade-commission-act",
    ingestUrl: "https://www.ftc.gov/legal-library/browse/statutes/federal-trade-commission-act",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "coppa",
    label: "COPPA (Children's Online Privacy)",
    institution: "U.S. Federal Trade Commission (FTC)",
    jurisdiction: "United States",
    category: "privacy",
    officialUrl: "https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa",
    ingestUrl: "https://www.ecfr.gov/api/versioner/v1/structure/current/title-16.json",
    license: "public_domain",
    format: "ecfr_json",
    monitorMode: "structured",
    // eCFR structure endpoint yields section IDs/titles only (no prose).
    ingestFullText: false,
  },
  {
    framework: "can_spam",
    label: "CAN-SPAM Act",
    institution: "U.S. Federal Trade Commission (FTC)",
    jurisdiction: "United States",
    category: "marketing",
    officialUrl: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business",
    ingestUrl: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "glba",
    label: "Gramm-Leach-Bliley Act (Safeguards Rule)",
    institution: "U.S. Federal Trade Commission (FTC)",
    jurisdiction: "United States",
    category: "financial",
    officialUrl: "https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act",
    ingestUrl: "https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "fcra",
    label: "Fair Credit Reporting Act (FCRA)",
    institution: "U.S. Consumer Financial Protection Bureau (CFPB) / FTC",
    jurisdiction: "United States",
    category: "financial",
    officialUrl: "https://www.consumerfinance.gov/rules-policy/regulations/1022/",
    ingestUrl: "https://www.consumerfinance.gov/rules-policy/regulations/1022/",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  // ── US federal: security standards (NIST) ────────────────────────────────────
  {
    framework: "nist_800_53",
    label: "NIST SP 800-53 Rev. 5",
    institution: "U.S. National Institute of Standards and Technology (NIST)",
    jurisdiction: "United States",
    category: "security",
    officialUrl: "https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final",
    ingestUrl:
      "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json",
    license: "public_domain",
    format: "oscal_json",
    monitorMode: "structured",
    ingestFullText: true,
  },
  {
    framework: "nist_csf",
    label: "NIST Cybersecurity Framework 2.0",
    institution: "U.S. National Institute of Standards and Technology (NIST)",
    jurisdiction: "United States",
    category: "security",
    officialUrl: "https://www.nist.gov/cyberframework",
    ingestUrl: "https://www.nist.gov/cyberframework",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "nist_800_171",
    label: "NIST SP 800-171 Rev. 3",
    institution: "U.S. National Institute of Standards and Technology (NIST)",
    jurisdiction: "United States",
    category: "security",
    officialUrl: "https://csrc.nist.gov/pubs/sp/800/171/r3/final",
    ingestUrl: "https://csrc.nist.gov/pubs/sp/800/171/r3/final",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  // ── US state privacy (comprehensive laws in effect) ──────────────────────────
  {
    framework: "ccpa",
    label: "CCPA/CPRA (Cal. Civ. Code §1798.100)",
    institution: "California Privacy Protection Agency (CPPA)",
    jurisdiction: "California, USA",
    category: "privacy",
    officialUrl: "https://cppa.ca.gov/regulations/",
    ingestUrl:
      "https://leginfo.legislature.ca.gov/faces/codes_displayexpandedbranch.xhtml?tocCode=CIV&division=3.&title=1.81.5.&part=4.",
    license: "public_domain",
    format: "html",
    monitorMode: "structured",
    ingestFullText: true,
  },
  {
    framework: "vcdpa",
    label: "Virginia Consumer Data Protection Act",
    institution: "Virginia Office of the Attorney General",
    jurisdiction: "Virginia, USA",
    category: "privacy",
    officialUrl: "https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/",
    ingestUrl: "https://law.lis.virginia.gov/vacodefull/title59.1/chapter53/",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "cpa_colorado",
    label: "Colorado Privacy Act",
    institution: "Colorado Department of Law (Attorney General)",
    jurisdiction: "Colorado, USA",
    category: "privacy",
    officialUrl: "https://coag.gov/resources/colorado-privacy-act/",
    ingestUrl: "https://coag.gov/resources/colorado-privacy-act/",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "ctdpa_connecticut",
    label: "Connecticut Data Privacy Act",
    institution: "Connecticut Office of the Attorney General",
    jurisdiction: "Connecticut, USA",
    category: "privacy",
    officialUrl: "https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act",
    ingestUrl: "https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "ucpa_utah",
    label: "Utah Consumer Privacy Act",
    institution: "Utah Division of Consumer Protection",
    jurisdiction: "Utah, USA",
    category: "privacy",
    officialUrl: "https://consumerprotection.utah.gov/",
    ingestUrl: "https://consumerprotection.utah.gov/",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "tdpsa_texas",
    label: "Texas Data Privacy and Security Act",
    institution: "Texas Office of the Attorney General",
    jurisdiction: "Texas, USA",
    category: "privacy",
    officialUrl: "https://www.texasattorneygeneral.gov/consumer-protection/data-privacy",
    ingestUrl: "https://www.texasattorneygeneral.gov/consumer-protection/data-privacy",
    license: "public_domain",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  // ── EU / UK ──────────────────────────────────────────────────────────────────
  {
    framework: "gdpr",
    label: "GDPR (Regulation (EU) 2016/679)",
    institution: "European Union (Parliament & Council) / EDPB",
    jurisdiction: "European Union",
    category: "privacy",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
    ingestUrl: "https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng",
    license: "eu_reuse",
    format: "html",
    monitorMode: "structured",
    ingestFullText: true,
  },
  {
    framework: "eprivacy",
    label: "ePrivacy Directive (Cookies)",
    institution: "European Union / EDPB",
    jurisdiction: "European Union",
    category: "privacy",
    officialUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058",
    ingestUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32002L0058",
    license: "eu_reuse",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "eu_ai_act",
    label: "EU AI Act (Regulation (EU) 2024/1689)",
    institution: "European Union / European Commission",
    jurisdiction: "European Union",
    category: "ai",
    officialUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng",
    ingestUrl: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj/eng",
    license: "eu_reuse",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "uk_gdpr",
    label: "UK GDPR & Data Protection Act 2018",
    institution: "UK Information Commissioner's Office (ICO)",
    jurisdiction: "United Kingdom",
    category: "privacy",
    officialUrl: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/",
    ingestUrl: "https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/",
    license: "proprietary",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  // ── Other national privacy regulators ────────────────────────────────────────
  {
    framework: "pipeda",
    label: "PIPEDA",
    institution: "Office of the Privacy Commissioner of Canada (OPC)",
    jurisdiction: "Canada",
    category: "privacy",
    officialUrl: "https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/",
    ingestUrl: "https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/",
    license: "proprietary",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "quebec_law25",
    label: "Quebec Law 25",
    institution: "Commission d'accès à l'information du Québec (CAI)",
    jurisdiction: "Quebec, Canada",
    category: "privacy",
    officialUrl: "https://www.cai.gouv.qc.ca/",
    ingestUrl: "https://www.cai.gouv.qc.ca/",
    license: "proprietary",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "lgpd",
    label: "LGPD (Lei Geral de Proteção de Dados)",
    institution: "Autoridade Nacional de Proteção de Dados (ANPD), Brazil",
    jurisdiction: "Brazil",
    category: "privacy",
    officialUrl: "https://www.gov.br/anpd/pt-br",
    ingestUrl: "https://www.gov.br/anpd/pt-br",
    license: "proprietary",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "australia_privacy_act",
    label: "Australian Privacy Act 1988",
    institution: "Office of the Australian Information Commissioner (OAIC)",
    jurisdiction: "Australia",
    category: "privacy",
    officialUrl: "https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act",
    ingestUrl: "https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act",
    license: "proprietary",
    format: "html",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  // ── Payments & security standards (private bodies — reference only) ──────────
  {
    framework: "pci_dss",
    label: "PCI DSS v4.0",
    institution: "PCI Security Standards Council",
    jurisdiction: "Global (industry standard)",
    category: "payments",
    officialUrl: "https://www.pcisecuritystandards.org/document_library/",
    ingestUrl: "https://www.pcisecuritystandards.org/document_library/",
    license: "proprietary",
    format: "reference_only",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "iso_27001",
    label: "ISO/IEC 27001:2022 (Annex A)",
    institution: "International Organization for Standardization (ISO)",
    jurisdiction: "Global (industry standard)",
    category: "security",
    officialUrl: "https://www.iso.org/standard/27001",
    ingestUrl: "https://www.iso.org/standard/27001",
    license: "proprietary",
    format: "reference_only",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
  {
    framework: "soc2",
    label: "SOC 2 (Trust Services Criteria)",
    institution: "American Institute of CPAs (AICPA)",
    jurisdiction: "Global (industry standard)",
    category: "security",
    officialUrl: "https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services",
    ingestUrl: "https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services",
    license: "proprietary",
    format: "reference_only",
    monitorMode: "source_watch",
    ingestFullText: false,
  },
] as const satisfies readonly RegulationSource[];

export type RegulationFrameworkId = (typeof REGULATION_SOURCE_LIST)[number]["framework"];

export const REGULATION_SOURCES = Object.fromEntries(REGULATION_SOURCE_LIST.map((s) => [s.framework, s])) as Record<
  RegulationFrameworkId,
  RegulationSource
>;

export const ALL_FRAMEWORK_IDS = REGULATION_SOURCE_LIST.map((s) => s.framework) as RegulationFrameworkId[];

/** Sources whose full text we may legally ingest and store. */
export function ingestableSources(): RegulationSource[] {
  return REGULATION_SOURCE_LIST.filter((s) => s.ingestFullText);
}

/**
 * Sources monitored purely by change-detection (no structured parse). Keyed on
 * `monitorMode` — the field that actually describes *how* we monitor — rather
 * than `ingestFullText` (which describes whether we store text), so a future
 * structured-but-not-stored feed is classified correctly.
 */
export function sourceWatchSources(): RegulationSource[] {
  return REGULATION_SOURCE_LIST.filter((s) => s.monitorMode === "source_watch");
}

/** Sources with a structured, machine-readable parse (OSCAL, eCFR, EUR-Lex, CA). */
export function structuredSources(): RegulationSource[] {
  return REGULATION_SOURCE_LIST.filter((s) => s.monitorMode === "structured");
}
