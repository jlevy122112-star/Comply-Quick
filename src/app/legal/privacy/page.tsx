import type { Metadata } from "next";
import { LegalDocumentLayout, type LegalSection } from "@/components/legal/LegalDocumentLayout";
import { COMPANY_LEGAL_NAME, LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, PRIVACY_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Privacy Policy - Comply-Quick",
  description: "How Comply-Quick collects, uses, protects, and manages personal information.",
};

const sections: LegalSection[] = [
  {
    id: "overview",
    heading: "1. Overview and Scope",
    body: [
      `${COMPANY_LEGAL_NAME} (“Comply-Quick,” “we,” or “us”) provides a compliance-automation SaaS platform. This Privacy Policy explains how we process personal information when you visit our sites, create an account, use the service, contact us, or interact with our public outputs.`,
      "If you use Comply-Quick through an agency or enterprise customer, that customer may determine the purposes of processing for project data. In that case, direct privacy requests to the relevant customer first; we will assist that customer as required by the applicable agreement.",
    ],
  },
  {
    id: "information",
    heading: "2. Information We Collect",
    body: ["Depending on how you interact with the service, we may collect:"],
    unorderedList: [
      "Identity and contact information, such as name, email address, organization, role, and support correspondence.",
      "Account and authentication information, including login identifiers, security events, preferences, and organization memberships.",
      "Billing and transaction information, such as subscription tier, payment status, invoices, tax information, and limited payment metadata received from payment providers.",
      "Product, device, and usage information, such as IP address, browser, device, pages, feature interactions, diagnostic events, and audit logs.",
      "Customer-submitted content, including website details, technology configuration, compliance inputs, project data, and generated-document content.",
      "Communications and feedback, including survey responses, support requests, security reports, and accessibility feedback.",
    ],
  },
  {
    id: "sources",
    heading: "3. Sources and Purposes",
    body: [
      "We obtain information from you, your organization or agency, your browser or device, service providers, and public or customer-authorized systems. We use it to:",
    ],
    unorderedList: [
      "Provide, authenticate, personalize, secure, troubleshoot, and support the service.",
      "Process subscriptions, prevent fraud, administer accounts, and communicate operational or legal notices.",
      "Generate compliance outputs, monitor regulatory signals, maintain audit trails, and improve reliability.",
      "Respond to rights requests, enforce agreements, investigate abuse, and comply with legal obligations.",
      "Measure performance and improve product experiences where permitted by law and your preferences.",
    ],
  },
  {
    id: "legal-bases",
    heading: "4. Legal Bases",
    body: [
      "Where GDPR or UK GDPR applies, our legal bases may include performance of a contract, legitimate interests in operating and securing the service, compliance with legal obligations, and consent for optional analytics, marketing, or similar activities.",
      "You may withdraw consent at any time for processing based on consent. Withdrawal does not affect processing that occurred before withdrawal or processing supported by another lawful basis.",
    ],
  },
  {
    id: "sharing",
    heading: "5. Sharing and Disclosure",
    body: ["We may disclose information to:"],
    unorderedList: [
      "Infrastructure, authentication, payment, artificial-intelligence, monitoring, communications, and other subprocessors needed to provide the service.",
      "Your organization, agency, administrators, and authorized collaborators according to account permissions.",
      "Professional advisers, insurers, auditors, or transaction counterparties subject to confidentiality obligations.",
      "Authorities, courts, or other recipients when required by law or reasonably necessary to protect rights, safety, or service integrity.",
    ],
    subsections: [
      {
        heading: "No Sale of Personal Information",
        body: [
          "We do not sell personal information for monetary consideration. We also do not share personal information for cross-context behavioral advertising as a business practice. Optional attribution or analytics technologies, if used, remain subject to applicable consent and controls.",
        ],
      },
    ],
  },
  {
    id: "cookies",
    heading: "6. Cookies and Similar Technologies",
    body: [
      "We use necessary and, where permitted, optional cookies and similar technologies for authentication, security, preferences, analytics, and service operations. See the Cookie Notice for categories, controls, Global Privacy Control handling, and third-party technology details.",
    ],
  },
  {
    id: "retention",
    heading: "7. Retention",
    body: [
      "We retain information for as long as needed to provide the service, maintain security and audit records, resolve disputes, enforce agreements, support legitimate business needs, and satisfy legal or accounting obligations.",
      "Retention varies by data type, account status, backup cycle, legal hold, and customer instruction. When information is no longer required, we delete, de-identify, or securely isolate it according to applicable procedures.",
    ],
  },
  {
    id: "security-transfers",
    heading: "8. Security and International Transfers",
    body: [
      "We use administrative, technical, and organizational safeguards such as access controls, encryption in transit, protections for supported stored data, logging, backups, vulnerability management, and incident response. No method of transmission or storage is completely secure.",
      "Data may be processed in the United States or other countries where we or our subprocessors operate. Where required, we use adequacy decisions, Standard Contractual Clauses, or another recognized transfer mechanism and consider supplementary safeguards.",
    ],
  },
  {
    id: "children",
    heading: "9. Children’s Privacy",
    body: [
      "Comply-Quick is not directed to children under 13, and we do not knowingly collect personal information from children under 13. Where a jurisdiction sets a higher age threshold, the service is not directed to children below that threshold, including individuals under 16 where applicable.",
      "If you believe a child provided information to us, contact us so we can investigate and delete it where appropriate.",
    ],
  },
  {
    id: "us-rights",
    heading: "10. U.S. State Privacy Rights",
    body: [
      "Depending on your state and applicable thresholds, you may have rights to confirm processing, access, correct, delete, obtain a portable copy, opt out of targeted advertising or profiling, and appeal a decision. We do not discriminate against people for exercising applicable rights.",
    ],
    subsections: [
      {
        heading: "California (CCPA/CPRA)",
        body: [
          "California residents may request access to and deletion or correction of personal information, information about categories collected and disclosed, and details about purposes and recipients. Categories may include identifiers, commercial information, internet or network activity, professional information, inferences, and customer-submitted content. We do not sell or share personal information as those terms are defined by the CCPA/CPRA. California residents may also submit a Shine the Light request concerning certain disclosures for direct marketing.",
        ],
      },
      {
        heading: "Virginia, Colorado, Connecticut, Utah, and Texas",
        body: [
          "Residents may have rights to access, correct, delete, obtain portability, and opt out of targeted advertising, sale, or certain profiling, subject to statutory exceptions. Colorado residents may appeal a denied request; other state laws may provide similar appeal or complaint mechanisms.",
        ],
      },
      {
        heading: "Louisiana",
        body: [
          "Louisiana residents may have rights under applicable Louisiana privacy law. We also maintain incident-response processes for Louisiana data-breach obligations, including the notification framework in La. R.S. 51:3071 et seq., as applicable to the facts and data involved.",
        ],
      },
    ],
  },
  {
    id: "international-rights",
    heading: "11. GDPR and UK Rights",
    body: [
      "Where GDPR or UK GDPR applies, individuals may have rights to access, correction, deletion, restriction, portability, objection, withdrawal of consent, and complaint to a supervisory authority. Rights may be limited by law and depend on the processing context.",
      "If an organization controls the relevant project data, we may direct your request to that organization and assist it under the DPA.",
    ],
  },
  {
    id: "exercise-rights",
    heading: "12. How to Exercise Rights",
    body: [
      `Send a request to ${PRIVACY_EMAIL} with your name, contact details, the right you are exercising, and enough context to locate the information. We may verify identity before completing a request and may ask for an authorized-agent document where applicable.`,
      "We generally respond within the period required by applicable law. If we deny a request, we will explain the basis and any available appeal or complaint path. We do not require an account solely to submit a request.",
    ],
  },
  {
    id: "changes-contact",
    heading: "13. Changes and Contact",
    body: [
      "We may update this Policy as our practices, technology, or legal requirements change. We will publish the revised version and update the effective date above; material changes may also be communicated through the service.",
      `Privacy questions and requests may be sent to ${PRIVACY_EMAIL}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      description="How Comply-Quick collects, uses, protects, and manages personal information and privacy rights."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={sections}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/cookies", label: "Cookie Notice" },
        { href: "/legal/dpa", label: "Data Processing Addendum" },
      ]}
    />
  );
}
