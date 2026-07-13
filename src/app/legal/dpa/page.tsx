import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "DPA Summary — Comply-Quick",
  description: "Summary of Comply-Quick data processing addendum commitments for controller-processor engagements.",
};

export default function DpaSummaryPage() {
  return (
    <LegalDocumentLayout
      title="Data Processing Addendum (DPA) Summary"
      description="This summary describes Comply-Quick's baseline controller-processor commitments. Enterprise customers may request signed DPA documentation."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "roles",
          heading: "1. Roles and Scope",
          body: [
            "Comply-Quick generally acts as a processor for customer-submitted operational data and as a controller for account, billing, and service administration data.",
            "Processing scope, duration, and purpose are defined in customer agreements and product configuration.",
          ],
        },
        {
          id: "processor-obligations",
          heading: "2. Processor Obligations",
          body: [
            "Comply-Quick processes data under documented instructions, applies confidentiality controls, and supports customer rights workflows as required by law.",
            "Subprocessor use is governed by contractual controls and appropriate security requirements.",
          ],
        },
        {
          id: "international-transfers",
          heading: "3. International Transfers",
          body: [
            "Where cross-border transfer safeguards are required, Comply-Quick supports contractual transfer mechanisms including standard contractual clauses where applicable.",
            "Customers may request transfer documentation through support@comply-quick.com.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/subprocessors", label: "Subprocessor Transparency" },
        { href: "/legal/privacy", label: "Privacy Policy" },
      ]}
    />
  );
}
