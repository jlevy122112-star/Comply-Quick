/**
 * EnterpriseModules.tsx
 * Enterprise-tier compliance modules: HIPAA, PCI-DSS, ADA/WCAG, SOC 2.
 * Each module generates specialized clauses, disclosures, and checklist items.
 */

// ─── Type Definitions ────────────────────────────────────────────────────────

export type ComplianceModule = "hipaa" | "pci_dss" | "ada_wcag" | "soc2";

export interface ModuleClause {
  title: string;
  body: string;
}

export interface ComplianceModuleOutput {
  moduleName: string;
  summary: string;
  clauses: ModuleClause[];
  checklistItems: string[];
}

// ─── Module Definitions ──────────────────────────────────────────────────────

const MODULE_OUTPUTS: Record<ComplianceModule, ComplianceModuleOutput> = {
  hipaa: {
    moduleName: "HIPAA Compliance Shield",
    summary:
      "Health Insurance Portability and Accountability Act (HIPAA) compliance requirements for applications that collect, store, transmit, or process Protected Health Information (PHI) or electronic Protected Health Information (ePHI).",
    clauses: [
      {
        title: "Business Associate Agreement (BAA) Requirement",
        body: 'Any entity that creates, receives, maintains, or transmits PHI on behalf of a covered entity must execute a Business Associate Agreement prior to accessing any health-related data. Developer shall not access, process, or store PHI unless a BAA is fully executed. Developer\'s role as a "Business Associate" under 45 CFR §160.103 is limited to the technical services specified in the project scope.',
      },
      {
        title: "PHI Data Handling & Encryption Standards",
        body: "All ePHI must be encrypted at rest using AES-256 or equivalent encryption and in transit using TLS 1.2 or higher. Access to ePHI is restricted to authorized personnel with role-based access controls (RBAC). Audit logs must capture all access events, modifications, and transmissions of ePHI with timestamps, user identifiers, and action descriptions. Data retention and disposal policies must comply with 45 CFR §164.530(j).",
      },
      {
        title: "Breach Notification Protocol",
        body: "In the event of an unauthorized acquisition, access, use, or disclosure of unsecured PHI, the covered entity must be notified without unreasonable delay and no later than 60 days from discovery. Individual notifications must be sent via first-class mail or email (if consented). Breaches affecting 500+ individuals require notification to the HHS Secretary and prominent media outlets in the affected jurisdiction.",
      },
      {
        title: "Minimum Necessary Standard",
        body: "Access to PHI must be limited to the minimum necessary to accomplish the intended purpose. Developer implementations must enforce field-level access controls ensuring that application interfaces, API responses, and database queries return only the minimum PHI fields required for each specific function or user role.",
      },
    ],
    checklistItems: [
      "Execute Business Associate Agreement (BAA) with all parties handling PHI",
      "Verify AES-256 encryption at rest for all ePHI storage locations",
      "Confirm TLS 1.2+ enforcement for all ePHI data transmissions",
      "Implement role-based access controls (RBAC) with minimum necessary access",
      "Deploy comprehensive audit logging for all PHI access and modification events",
      "Establish breach notification procedures with 60-day maximum response timeline",
      "Conduct HIPAA Security Risk Assessment per 45 CFR §164.308(a)(1)",
      "Verify data backup and disaster recovery procedures for PHI systems",
    ],
  },

  pci_dss: {
    moduleName: "PCI-DSS Payment Security Shield",
    summary:
      "Payment Card Industry Data Security Standard (PCI-DSS v4.0) compliance requirements for applications that process, store, or transmit cardholder data including primary account numbers (PAN), cardholder names, expiration dates, and service codes.",
    clauses: [
      {
        title: "Cardholder Data Environment (CDE) Scope Limitation",
        body: "Developer's implementation strictly limits the Cardholder Data Environment to components directly involved in processing, storing, or transmitting cardholder data. All systems, networks, and processes connected to or capable of impacting the CDE are within scope for PCI-DSS compliance. Developer recommends and implements network segmentation to minimize CDE scope wherever architecturally feasible.",
      },
      {
        title: "Payment Tokenization & PAN Handling",
        body: "Primary Account Numbers (PAN) must never be stored in plaintext. Developer implements tokenization via the payment processor's SDK (Stripe Elements, Braintree Hosted Fields, or equivalent) to ensure raw cardholder data never touches Merchant's servers. If PAN storage is unavoidable, it must be rendered unreadable using strong one-way hash functions, truncation, index tokens, or strong cryptography with associated key management processes.",
      },
      {
        title: "Vulnerability Management Program",
        body: "All system components within the CDE must run current, vendor-supported software with security patches applied within 30 days of release for critical vulnerabilities. Developer implements automated vulnerability scanning on a quarterly basis and penetration testing annually (or after any significant infrastructure change). Anti-malware solutions must be deployed on all systems commonly affected by malware.",
      },
      {
        title: "Access Control & Authentication",
        body: "Access to cardholder data and CDE systems requires unique identification for each person with access. Multi-factor authentication (MFA) is required for all remote access and administrative access to the CDE. Default vendor passwords must be changed before deployment. Access privileges must be reviewed at least every six months.",
      },
    ],
    checklistItems: [
      "Verify payment tokenization — confirm PAN never touches application servers",
      "Confirm TLS 1.2+ for all payment data transmissions",
      "Validate network segmentation isolating CDE from non-CDE systems",
      "Verify no cardholder data in application logs, error messages, or debug output",
      "Confirm unique user IDs and MFA for all CDE administrative access",
      "Run quarterly ASV (Approved Scanning Vendor) vulnerability scan",
      "Verify default credentials changed on all CDE system components",
      "Confirm PCI-DSS Self-Assessment Questionnaire (SAQ) type determination",
    ],
  },

  ada_wcag: {
    moduleName: "ADA / WCAG Accessibility Compliance Shield",
    summary:
      "Americans with Disabilities Act (ADA) Title III and Web Content Accessibility Guidelines (WCAG 2.2 Level AA) compliance requirements for web applications to ensure equal access and usability for individuals with disabilities.",
    clauses: [
      {
        title: "WCAG 2.2 Level AA Conformance Commitment",
        body: "Developer implements the application in accordance with WCAG 2.2 Level AA success criteria as the minimum accessibility standard. This includes conformance across all four WCAG principles: Perceivable (text alternatives, adaptable content, distinguishable presentation), Operable (keyboard accessible, sufficient time, no seizure-inducing content, navigable), Understandable (readable, predictable, input assistance), and Robust (compatible with assistive technologies including screen readers, voice control, and switch devices).",
      },
      {
        title: "Assistive Technology Compatibility",
        body: "All interactive elements, forms, navigation components, and dynamic content must be fully compatible with assistive technologies including JAWS, NVDA, VoiceOver, TalkBack, Dragon NaturallySpeaking, and browser-based accessibility features. ARIA (Accessible Rich Internet Applications) attributes must be correctly implemented on all custom interactive components. Semantic HTML must be used as the foundation with ARIA supplementation only where native semantics are insufficient.",
      },
      {
        title: "Ongoing Accessibility Maintenance",
        body: "Merchant acknowledges that accessibility compliance is an ongoing obligation, not a one-time achievement. All content updates, new features, and third-party integrations must maintain WCAG 2.2 Level AA conformance. Developer's accessibility guarantee is limited to the initial scope; post-handoff modifications are Merchant's responsibility to audit and maintain.",
      },
      {
        title: "Voluntary Product Accessibility Template (VPAT)",
        body: "Developer provides a completed VPAT (Voluntary Product Accessibility Template) documenting the application's conformance level against WCAG 2.2 criteria. This document is provided for informational purposes and does not constitute a legal guarantee of full compliance. Merchant should engage an independent accessibility auditor for formal conformance certification.",
      },
    ],
    checklistItems: [
      "Run automated accessibility scan (axe-core, Lighthouse) — resolve all critical violations",
      "Verify complete keyboard navigation for all interactive elements (Tab, Enter, Escape, Arrow keys)",
      "Test with screen readers (NVDA on Windows, VoiceOver on macOS/iOS) end-to-end",
      "Confirm color contrast ratios meet WCAG 2.2 AA minimums (4.5:1 normal text, 3:1 large text)",
      "Verify all images have meaningful alt text (or empty alt for decorative images)",
      "Confirm form inputs have associated labels, error messages, and instruction text",
      "Test focus management on modal dialogs, dropdowns, and dynamic content",
      "Verify skip navigation links are present and functional",
      "Confirm no content relies solely on color to convey information",
      "Generate VPAT documenting conformance status against WCAG 2.2 criteria",
    ],
  },

  soc2: {
    moduleName: "SOC 2 Type II Security Controls Shield",
    summary:
      "Service Organization Control (SOC 2) Type II compliance framework based on the AICPA Trust Services Criteria covering Security, Availability, Processing Integrity, Confidentiality, and Privacy principles for service organizations.",
    clauses: [
      {
        title: "Security Principle — Logical & Physical Access Controls",
        body: "The system is protected against unauthorized access (both logical and physical) per SOC 2 Common Criteria CC6.1–CC6.8. Developer implements logical access controls including role-based permissions, multi-factor authentication, session management, and encryption of credentials. Physical access controls for infrastructure (where applicable) are the responsibility of the hosting provider and must be verified through the provider's own SOC 2 report.",
      },
      {
        title: "Availability Principle — System Uptime & Recovery",
        body: "System availability commitments are defined per SOC 2 Availability criteria A1.1–A1.3. Developer implements monitoring, alerting, backup procedures, and disaster recovery capabilities as specified in the project scope. Merchant acknowledges that availability guarantees are subject to the hosting provider's SLA and that Developer's obligation is limited to application-level availability measures, not infrastructure uptime.",
      },
      {
        title: "Confidentiality Principle — Data Classification & Protection",
        body: "Confidential information is protected throughout its lifecycle per SOC 2 Confidentiality criteria C1.1–C1.2. Developer implements data classification tagging, encryption at rest and in transit, access logging, and secure disposal procedures for confidential data. Merchant must define and communicate data classification levels applicable to their business context.",
      },
      {
        title: "Change Management & System Operations",
        body: "All changes to the system follow a formal change management process per SOC 2 Common Criteria CC8.1. This includes version control, peer code review, automated testing, staged deployment (development, staging, production), and rollback procedures. Emergency changes must be documented retrospectively within 24 hours and reviewed in the next change advisory board cycle.",
      },
    ],
    checklistItems: [
      "Document all access control policies — user provisioning, deprovisioning, and access reviews",
      "Verify MFA enforcement for all administrative and production system access",
      "Confirm encryption at rest (AES-256) and in transit (TLS 1.2+) for all sensitive data",
      "Establish and test incident response plan with defined roles, escalation, and communication",
      "Implement automated monitoring and alerting for system availability and security events",
      "Document change management procedures — version control, code review, deployment pipeline",
      "Verify backup procedures with tested recovery — document RPO and RTO targets",
      "Complete vendor risk assessment for all third-party service providers",
      "Establish data retention and secure disposal policies with documented schedules",
      "Prepare evidence collection procedures for SOC 2 Type II audit observation period",
    ],
  },
};

const VALID_MODULES: ReadonlySet<string> = new Set([
  "hipaa",
  "pci_dss",
  "ada_wcag",
  "soc2",
]);

export function validateModules(modules: ComplianceModule[]): void {
  for (const mod of modules) {
    if (!VALID_MODULES.has(mod)) {
      throw new Error(
        `Invalid compliance module: "${mod}". Must be "hipaa", "pci_dss", "ada_wcag", or "soc2".`
      );
    }
  }
}

export function generateModuleOutputs(
  modules: ComplianceModule[]
): ComplianceModuleOutput[] {
  validateModules(modules);
  return modules.map((mod) => MODULE_OUTPUTS[mod]);
}

export const MODULE_OPTIONS: {
  value: ComplianceModule;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    value: "hipaa",
    label: "HIPAA",
    icon: "🏥",
    description: "Healthcare data & PHI protection",
  },
  {
    value: "pci_dss",
    label: "PCI-DSS",
    icon: "💳",
    description: "Payment card data security",
  },
  {
    value: "ada_wcag",
    label: "ADA / WCAG",
    icon: "♿",
    description: "Web accessibility compliance",
  },
  {
    value: "soc2",
    label: "SOC 2",
    icon: "🔒",
    description: "Security & trust controls",
  },
];
