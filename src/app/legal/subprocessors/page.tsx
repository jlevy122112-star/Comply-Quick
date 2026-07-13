import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Subprocessor Transparency — Comply-Quick",
  description: "Subprocessor categories and governance commitments for Comply-Quick data flows.",
};

export default function SubprocessorsPage() {
  return (
    <LegalDocumentLayout
      title="Subprocessor Transparency"
      description="Comply-Quick maintains subprocessor governance for customer-impacting data flows and contractual controls."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "categories",
          heading: "1. Subprocessor Categories",
          body: [
            "Subprocessors may include infrastructure providers, payment processors, analytics platforms, and communications services required to operate Comply-Quick.",
            "Each category is assessed for data minimization, contractual safeguards, and operational necessity.",
          ],
        },
        {
          id: "governance",
          heading: "2. Governance Controls",
          body: [
            "Comply-Quick performs due diligence before onboarding subprocessors and periodically reassesses security and compliance posture.",
            "Subprocessor agreements include confidentiality, data protection, and breach notification obligations.",
          ],
        },
        {
          id: "change-notice",
          heading: "3. Change Notice and Objection",
          body: [
            "Material subprocessor changes are documented and communicated through customer channels where contractual notice applies.",
            "For enterprise agreements that include objection workflows, Comply-Quick will handle objections in line with contractual terms.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/dpa", label: "DPA Summary" },
        { href: "/legal/privacy", label: "Privacy Policy" },
      ]}
    />
  );
}
