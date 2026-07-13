import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Accessibility Statement — Comply-Quick",
  description: "Accessibility commitment and support channels for Comply-Quick.",
};

export default function AccessibilityStatementPage() {
  return (
    <LegalDocumentLayout
      title="Accessibility Statement"
      description="Comply-Quick is committed to building accessible, inclusive product and marketing experiences for all users."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "commitment",
          heading: "1. Commitment",
          body: [
            "We work to align product and web experiences with recognized accessibility principles and continuously improve accessibility outcomes.",
            "Accessibility is integrated into design, engineering, and QA processes for customer-facing experiences.",
          ],
        },
        {
          id: "continuous-improvement",
          heading: "2. Continuous Improvement",
          body: [
            "Comply-Quick monitors accessibility issues, prioritizes remediation, and tracks improvements as part of product release cycles.",
            "Known limitations are reviewed for severity, impact, and remediation path.",
          ],
        },
        {
          id: "contact",
          heading: "3. Accessibility Support Contact",
          body: [
            "If you encounter accessibility barriers, contact support@comply-quick.com and include the page URL, issue details, and preferred communication method.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/legal/notices", label: "Legal Notices" },
      ]}
    />
  );
}
