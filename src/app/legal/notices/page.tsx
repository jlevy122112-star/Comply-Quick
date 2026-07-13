import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Legal Notices — Comply-Quick",
  description: "Regulatory and jurisdictional legal notices for Comply-Quick operations.",
};

export default function LegalNoticesPage() {
  return (
    <LegalDocumentLayout
      title="Legal Notices"
      description="This page summarizes regulatory notices and jurisdiction coverage signals for Comply-Quick and directs formal legal correspondence."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "jurisdiction",
          heading: "1. Jurisdiction and Regulatory Scope",
          body: [
            "Comply-Quick is operated in the United States and serves customers across multiple jurisdictions. Legal requirements may vary based on customer location and data processing context.",
            "State and federal requirements, including privacy, consumer, and breach notification obligations, are tracked as part of our ongoing compliance program.",
          ],
        },
        {
          id: "louisiana-context",
          heading: "2. Louisiana Operational Context",
          body: [
            "For Louisiana operations, Comply-Quick tracks state-specific requirements including data breach response obligations and evolving privacy law applicability.",
            "This notice is informational and does not replace legal advice; counsel review is required before final legal deployment.",
          ],
        },
        {
          id: "legal-contact",
          heading: "3. Legal Contact",
          body: [
            "Send legal notices, compliance requests, or counsel communications to support@comply-quick.com with the subject line LEGAL NOTICE.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/packet", label: "Counsel Review Packet" },
        { href: "/legal/terms", label: "Terms of Service" },
      ]}
    />
  );
}
