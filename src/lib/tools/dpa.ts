// Data Processing Agreement (DPA) generator.
//
// Assembles a controller↔processor DPA in Markdown whose clauses are DERIVED
// from the same canonical datasets the rest of the app uses:
//   * Target regions  → governing-law + cross-border transfer clauses (GDPR SCCs,
//     LGPD, PIPEDA, CCPA "service provider" language, etc.).
//   * Tracking pixels → the Annex II subprocessor register (reuses
//     buildSubprocessorMap so the DPA and the standalone map never disagree).
//   * Enterprise modules (HIPAA/PCI/SOC2/ADA) → additional security clauses via
//     the existing generateModuleOutputs engine.
//
// The output is attorney-reviewable Markdown, consistent with the rest of
// Comply-Quick's generated artifacts (see exportToMarkdown in ClauseEngine).

import { generateModuleOutputs, type ComplianceModule } from "@/components/EnterpriseModules";
import { REPORT_DISCLAIMER } from "@/lib/legal";
import { buildSubprocessorMap } from "./subprocessors";
import { REGION_RULES, type TargetRegion, type TrackingPixel } from "./data";

export interface DpaInput {
  controllerName: string;
  processorName: string;
  regions: TargetRegion[];
  pixels: TrackingPixel[];
  modules?: ComplianceModule[];
  effectiveDate?: string;
}

export interface DpaResult {
  markdown: string;
  /** Section headings included (for a table-of-contents / preview UI). */
  sections: string[];
  subprocessorCount: number;
}

/** Region-specific processing clauses, keyed by jurisdiction. */
function regionClause(region: TargetRegion): string {
  const meta = REGION_RULES[region];
  switch (region) {
    case "eu_gdpr":
      return `**${meta.name} (${meta.law}).** The Processor shall process Personal Data only on documented instructions from the Controller, including with regard to transfers to a third country, unless required by Union or Member State law. Where Personal Data is transferred outside the EEA/UK, the parties shall rely on the European Commission's Standard Contractual Clauses (2021/914) or the UK International Data Transfer Addendum, together with any supplementary measures identified by a transfer impact assessment. Data subjects may exercise rights under Articles 12–23 GDPR, and the Processor shall assist the Controller in responding within the statutory timelines.`;
    case "california_ccpa":
      return `**${meta.name} (${meta.law}).** The Processor acts as a "Service Provider" and shall not (a) sell or share Personal Information, (b) retain, use, or disclose it for any purpose other than the business purposes specified in this Agreement, or (c) combine it with Personal Information from other sources except as permitted by the CCPA/CPRA. The Processor certifies that it understands and will comply with these restrictions.`;
    case "brazil_lgpd":
      return `**${meta.name} (${meta.law}).** Processing shall comply with the LGPD (Lei nº 13.709/2018). The Processor (operador) shall process Personal Data strictly per the Controller's (controlador's) instructions and shall support the Controller in honoring data subject rights under Article 18 and in reporting incidents to the ${meta.authority}.`;
    case "canada_pipeda":
      return `**${meta.name} (${meta.law}).** The Processor shall provide a comparable level of protection to Personal Data as required by PIPEDA's ten fair information principles while it is being processed on the Controller's behalf, and shall assist with access and correction requests handled by the ${meta.authority}.`;
    case "australia_privacy":
      return `**${meta.name} (${meta.law}).** Processing shall conform to the Australian Privacy Principles (APPs). The Processor shall take reasonable steps to protect Personal Information from misuse, interference, and loss, and shall support notifiable data breach assessments under the ${meta.authority}.`;
    case "us_general":
      return `**${meta.name} (${meta.law}).** The Processor shall process Personal Data consistent with applicable US state privacy laws and the Controller's documented instructions, and shall support consumer rights requests recognized in the relevant states.`;
  }
}

/** Builds a controller↔processor DPA in Markdown from the selected inputs. */
export function generateDpa(input: DpaInput): DpaResult {
  const controller = input.controllerName.trim() || "[Controller Legal Name]";
  const processor = input.processorName.trim() || "[Processor Legal Name]";
  const effectiveDate = input.effectiveDate?.trim() || new Date().toISOString().slice(0, 10);
  const regions = input.regions.length > 0 ? input.regions : (["eu_gdpr"] as TargetRegion[]);
  const modules = input.modules ?? [];

  const subMap = buildSubprocessorMap(input.pixels);
  const moduleOutputs = generateModuleOutputs(modules);

  const sections: string[] = [];
  const out: string[] = [];

  const push = (heading: string, body: string) => {
    sections.push(heading);
    out.push(`## ${heading}\n\n${body}`);
  };

  out.push(`# Data Processing Agreement`);
  out.push(`**Controller:** ${controller}  \n**Processor:** ${processor}  \n**Effective Date:** ${effectiveDate}`);
  out.push(
    `This Data Processing Agreement ("DPA") forms part of the agreement between the Controller and the Processor and governs the Processing of Personal Data by the Processor on behalf of the Controller.`
  );

  push(
    "1. Definitions",
    `"Personal Data", "Processing", "Controller", "Processor", "Data Subject", and "Supervisory Authority" have the meanings given in applicable Data Protection Laws. "Data Protection Laws" means all laws applicable to the Processing of Personal Data under this DPA, including those of the jurisdictions listed in Section 3.`
  );

  push(
    "2. Scope & Roles",
    `The Controller determines the purposes and means of Processing. The Processor Processes Personal Data solely to provide the contracted services and only on the Controller's documented instructions. Each party shall comply with its respective obligations under the Data Protection Laws.`
  );

  push("3. Governing Data Protection Laws", regions.map((r) => `- ${regionClause(r)}`).join("\n\n"));

  push(
    "4. Processor Obligations",
    [
      "- Process Personal Data only on the Controller's documented instructions;",
      "- Ensure persons authorized to Process Personal Data are bound by confidentiality;",
      "- Implement appropriate technical and organizational security measures (Section 5);",
      "- Respect the conditions for engaging Subprocessors (Section 6 and Annex II);",
      "- Assist the Controller with data subject requests and with security, breach-notification, and impact-assessment obligations;",
      "- At the Controller's choice, delete or return all Personal Data at the end of the services; and",
      "- Make available information necessary to demonstrate compliance and allow for audits.",
    ].join("\n")
  );

  const securityBase = [
    "The Processor shall implement and maintain appropriate technical and organizational measures, including as relevant: encryption of Personal Data in transit (TLS 1.2+) and at rest; access controls on a least-privilege basis; logging and monitoring; regular backups and tested recovery; and a documented vulnerability-management process.",
  ];
  if (moduleOutputs.length > 0) {
    securityBase.push("\nThe following module-specific controls also apply:\n");
    for (const m of moduleOutputs) {
      securityBase.push(`**${m.moduleName}.** ${m.summary}`);
      for (const c of m.clauses) securityBase.push(`- *${c.title}:* ${c.body}`);
    }
  }
  push("5. Security Measures", securityBase.join("\n"));

  push(
    "6. Subprocessors",
    subMap.rows.length > 0
      ? `The Controller authorizes the Processor to engage the Subprocessors listed in **Annex II**. The Processor shall impose data protection obligations on each Subprocessor no less protective than those in this DPA and remains liable for their performance. The Processor shall inform the Controller of any intended addition or replacement of a Subprocessor, giving the Controller the opportunity to object.`
      : `The Processor shall not engage any Subprocessor without the Controller's prior specific or general written authorization. Any authorized Subprocessor shall be bound by data protection obligations no less protective than those in this DPA.`
  );

  push(
    "7. International Transfers",
    `Where Processing involves a transfer of Personal Data across borders, the parties shall ensure an adequate transfer mechanism is in place (e.g., adequacy decision, Standard Contractual Clauses, or applicable statutory derogations) consistent with the jurisdictions in Section 3.`
  );

  push(
    "8. Personal Data Breach",
    `The Processor shall notify the Controller without undue delay after becoming aware of a Personal Data Breach and shall provide sufficient information to allow the Controller to meet any obligations to report the breach to a Supervisory Authority or affected Data Subjects.`
  );

  push(
    "9. Return & Deletion",
    `Upon termination of the services, the Processor shall, at the Controller's election, return or securely delete all Personal Data, and delete existing copies unless retention is required by law.`
  );

  push(
    "Annex I — Details of Processing",
    [
      `**Categories of Data Subjects:** website visitors, customers, and end users of the Controller's services.`,
      `**Categories of Personal Data:** ${
        subMap.allDataCategories.length > 0
          ? subMap.allDataCategories.join(", ")
          : "identifiers and online activity data as configured by the Controller"
      }.`,
      `**Nature & Purpose of Processing:** provision of the contracted analytics, advertising, and website services.`,
      `**Duration:** for the term of the services and any legally required retention period.`,
    ].join("\n\n")
  );

  push(
    "Annex II — Approved Subprocessors",
    subMap.rows.length > 0 ? subMap.markdown : "_No third-party Subprocessors are engaged under this DPA._"
  );

  out.push(`---\n\n_${REPORT_DISCLAIMER}_`);

  return {
    markdown: out.join("\n\n"),
    sections,
    subprocessorCount: subMap.rows.length,
  };
}
