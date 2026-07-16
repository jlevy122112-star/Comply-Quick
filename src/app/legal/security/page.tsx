import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SECURITY_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Security Policy - Comply-Quick",
  description: "Security practices, vulnerability reporting, and incident response for Comply-Quick.",
};

export default function SecurityPage() {
  return (
    <LegalDocumentLayout
      title="Security Policy"
      description="Comply-Quick applies layered administrative, technical, and operational safeguards to protect service availability, confidentiality, and integrity."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "program",
          heading: "1. Security Program",
          body: [
            "Security is incorporated into product design, engineering, operations, vendor management, and incident response. Controls are selected and improved based on the sensitivity of information, the threats we observe, and the services we operate.",
            "This policy describes current practices and reasonable commitments. It does not represent a certification, audit opinion, or guarantee that every risk has been eliminated.",
          ],
        },
        {
          id: "technical",
          heading: "2. Technical and Infrastructure Controls",
          body: ["Controls may include:"],
          unorderedList: [
            "Encryption in transit using modern transport protections and encryption or equivalent safeguards for supported stored data.",
            "Role-based access, least privilege, authenticated administrative access, secret-management practices, and review of elevated permissions.",
            "Application and infrastructure logging, monitoring, alerting, backups, recovery procedures, and change-management controls.",
            "Managed infrastructure and service providers selected for operational needs, contractual safeguards, and security posture.",
          ],
        },
        {
          id: "access",
          heading: "3. Access and Customer Responsibilities",
          body: [
            "Access to production systems and customer data is limited according to role and operational need. We may review access events and investigate anomalous activity.",
            "Customers are responsible for strong credentials, multi-factor authentication where available, assigning appropriate roles, configuring integrations, reviewing generated outputs, and deciding what information to submit.",
          ],
        },
        {
          id: "vulnerability",
          heading: "4. Vulnerability Management",
          body: [
            "We use reasonable processes to identify, prioritize, remediate, and verify security vulnerabilities. Timing depends on severity, exploitability, affected component, and operational risk.",
            "We may use automated testing, dependency review, code review, monitoring, and responsible reports. No testing process detects every vulnerability.",
          ],
          subsections: [
            {
              heading: "Responsible Disclosure",
              body: [
                `Send vulnerability reports to ${SECURITY_EMAIL} with the subject line SECURITY. Include reproduction steps, affected endpoints, impact assumptions, and a safe contact method. Please avoid accessing other users’ data, destructive testing, denial-of-service activity, or public disclosure before we have a reasonable opportunity to investigate.`,
              ],
            },
          ],
        },
        {
          id: "incident",
          heading: "5. Incident Response and Breach Notification",
          body: [
            "Security events are triaged by severity, contained, investigated, remediated, and reviewed for corrective actions. Where appropriate, we preserve evidence and coordinate with service providers or authorities.",
            "If we confirm a security incident affecting customer information, we will notify affected customers without undue delay where required by contract or law and provide information reasonably available about impact, response, and mitigation. Notification timing may be constrained by law enforcement or security considerations.",
          ],
        },
        {
          id: "contact",
          heading: "6. Security Contact",
          body: [`Security questions and reports may be sent to ${SECURITY_EMAIL}.`],
        },
      ]}
      relatedLinks={[
        { href: "/legal/dpa", label: "Data Processing Addendum" },
        { href: "/legal/sla", label: "Support SLA" },
      ]}
    />
  );
}
