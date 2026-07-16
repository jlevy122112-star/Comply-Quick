import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Data Processing Addendum - Comply-Quick",
  description: "Data Processing Addendum for customer personal-data processing by Comply-Quick.",
};

export default function DpaPage() {
  return (
    <LegalDocumentLayout
      title="Data Processing Addendum"
      description="This Data Processing Addendum describes baseline processor commitments for customer operational data. Enterprise customers may request a signed copy for an applicable order."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "scope",
          heading: "1. Scope, Roles, and Definitions",
          body: [
            "This Addendum applies when a customer submits Personal Data to Comply-Quick for processing through the service. The customer is the Controller or business, and Comply-Quick is the Processor or service provider for that data.",
            "Comply-Quick acts as an independent Controller for account registration, billing, support, security, service administration, and product-improvement data described in the Privacy Policy.",
            "“Personal Data,” “Processing,” “Controller,” “Processor,” and “Data Subject” have the meanings given by applicable Data Protection Laws.",
          ],
        },
        {
          id: "processing-details",
          heading: "2. Processing Details",
          body: [
            "The subject matter is the hosting, analysis, generation, storage, and delivery of compliance workflows and outputs. Processing continues for the customer’s subscription term and any legally required deletion or retention period.",
          ],
          subsections: [
            {
              heading: "Nature and Purpose",
              body: [
                "Processing includes collection, organization, storage, retrieval, analysis, generation, transmission, support, security monitoring, backup, and deletion as necessary to provide the service and follow documented customer instructions.",
              ],
            },
            {
              heading: "Data Subjects",
              unorderedList: [
                "Customer personnel, account users, agency users, and invited collaborators.",
                "Individuals whose information a customer chooses to submit in project, compliance, support, or generated-output data.",
                "Website visitors or other individuals represented in customer-submitted datasets, where applicable.",
              ],
            },
            {
              heading: "Personal Data Categories",
              unorderedList: [
                "Identity and contact data, account identifiers, credentials metadata, and professional information.",
                "Technical identifiers, device and usage data, audit events, support communications, and security logs.",
                "Customer-submitted operational, website, compliance, and generated-document data, which may include special categories only if the customer elects to submit them and has a lawful basis.",
              ],
            },
          ],
        },
        {
          id: "obligations",
          heading: "3. Processor Obligations",
          body: [
            "Comply-Quick will process customer Personal Data only on documented instructions, including to provide the service, maintain security, comply with law, and follow the customer’s configuration.",
            "Persons authorized to process Personal Data are subject to confidentiality obligations. Comply-Quick will implement reasonable technical and organizational measures appropriate to the risk, as described in the Security Policy and Annex-style controls below.",
          ],
          unorderedList: [
            "Assist with reasonable rights, correction, deletion, export, restriction, and compliance requests.",
            "Maintain procedures for detecting, containing, and responding to Personal Data breaches.",
            "Provide information reasonably necessary to demonstrate compliance, subject to confidentiality, security, and proportionality limits.",
          ],
        },
        {
          id: "security",
          heading: "4. Security Measures",
          body: [
            "Controls may include encryption in transit, encryption or equivalent protection for supported stored data, access control, least privilege, authentication safeguards, logging, backups, vulnerability management, change control, and incident-response procedures.",
            "Security controls evolve with the service and risk environment. No security measure eliminates all risk, and the customer remains responsible for configuring access and deciding what data to submit.",
          ],
        },
        {
          id: "subprocessors",
          heading: "5. Subprocessors",
          body: [
            "The customer authorizes use of the subprocessors listed on /legal/subprocessors, subject to applicable contractual safeguards. Comply-Quick remains responsible for its subprocessors’ performance of their processing obligations.",
            "We may add or replace subprocessors for legitimate service purposes. Where a contract requires notice, we will provide notice through the service or another reasonable channel and allow objections on the contractual timetable.",
          ],
        },
        {
          id: "rights-breach",
          heading: "6. Rights Assistance and Breach Notice",
          body: [
            "Taking into account the nature of processing, Comply-Quick will provide reasonable assistance for Data Subject requests and regulatory obligations. The customer must provide the instructions and information needed for us to act.",
            "Comply-Quick will notify the customer without undue delay after confirming a Personal Data breach affecting customer data, subject to law-enforcement restrictions and the information reasonably available at the time. Notices will describe known impact and response steps as they develop.",
          ],
        },
        {
          id: "deletion-audits",
          heading: "7. Return, Deletion, and Audits",
          body: [
            "At the customer’s choice and subject to law, Comply-Quick will delete or return customer Personal Data after termination. Residual copies may remain in encrypted backups until ordinary rotation, remain protected, and not be actively processed except as legally required.",
            "Audit requests must be reasonable, relevant, secure, and not unreasonably disrupt operations or expose another customer’s information. Available security documentation, summaries, and responses to written questionnaires may satisfy a request before an onsite or technical audit is considered.",
          ],
        },
        {
          id: "transfers",
          heading: "8. International Transfers",
          body: [
            "Where a transfer of Personal Data requires a lawful mechanism, the parties will use an applicable adequacy decision, Standard Contractual Clauses, or another recognized mechanism. Transfer assessments and supplementary safeguards will be considered where required.",
            `Customers may request relevant transfer documentation through ${SUPPORT_EMAIL}.`,
          ],
        },
        {
          id: "ccpa",
          heading: "9. U.S. Service-Provider Terms",
          body: [
            "For Personal Information subject to the CCPA/CPRA, Comply-Quick acts as a service provider or contractor and will not sell or share it, retain, use, or disclose it outside the business purposes specified in the customer agreement and as permitted by law.",
            "Comply-Quick will provide reasonable assistance for consumer requests and will notify the customer if it can no longer meet applicable service-provider obligations. The customer remains responsible for required notices, instructions, and lawful collection.",
          ],
        },
        {
          id: "precedence",
          heading: "10. Order of Precedence and Contact",
          body: [
            "If this Addendum conflicts with a signed order form or negotiated data-processing agreement, the signed agreement controls for that conflict. Otherwise, the Terms of Service and this Addendum are read together.",
            `Questions or requests for a signed enterprise copy may be sent to ${SUPPORT_EMAIL}.`,
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/legal/security", label: "Security Policy" },
        { href: "/legal/subprocessors", label: "Subprocessor Transparency" },
      ]}
    />
  );
}
