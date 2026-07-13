import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Security Policy — Comply-Quick",
  description: "Security controls, vulnerability reporting, and incident response commitments for Comply-Quick.",
};

export default function SecurityPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Security Policy"
      description="Comply-Quick applies layered administrative, technical, and operational safeguards to protect service availability, confidentiality, and integrity."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "security-controls",
          heading: "1. Core Security Controls",
          body: [
            "Comply-Quick enforces role-based access control, least privilege, and authenticated access for production systems.",
            "We monitor application and infrastructure events, enforce change control, and maintain backup and recovery procedures.",
          ],
        },
        {
          id: "incident-response",
          heading: "2. Incident Response",
          body: [
            "Security incidents are triaged by severity, contained, remediated, and reviewed with documented corrective actions.",
            "Where legally required, customer and regulator notifications are issued according to applicable incident and breach notification rules.",
          ],
        },
        {
          id: "vulnerability-reporting",
          heading: "3. Vulnerability Reporting",
          body: [
            "We welcome responsible disclosure. Send reports to support@comply-quick.com with the subject line SECURITY.",
            "Please include reproduction details, impact assumptions, and affected endpoints to help rapid validation.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/sla", label: "Support SLA" },
        { href: "/legal/privacy", label: "Privacy Policy" },
      ]}
    />
  );
}
