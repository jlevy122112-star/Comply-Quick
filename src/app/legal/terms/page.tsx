import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { TERMS_OF_SERVICE, TERMS_EFFECTIVE_DATE, TERMS_VERSION, REPORT_DISCLAIMER } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Comply-Quick",
  description:
    "Comply-Quick Terms of Service, including the limitation of liability and client responsibilities for generated compliance content.",
};

export default function TermsOfServicePage() {
  const sections = TERMS_OF_SERVICE.map((section) => ({
    id: section.heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    heading: section.heading,
    body: section.body,
  }));

  sections.unshift({
    id: "disclaimer",
    heading: "Mandatory Compliance Disclaimer",
    body: [REPORT_DISCLAIMER],
  });

  return (
    <LegalDocumentLayout
      title="Terms of Service"
      description="These Terms govern access to Comply-Quick, including acceptable use, legal limitations, and client responsibilities for generated compliance outputs."
      effectiveDate={TERMS_EFFECTIVE_DATE}
      version={TERMS_VERSION}
      sections={sections}
      relatedLinks={[
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/legal/subscription", label: "Subscription & Cancellation Policy" },
        { href: "/legal/acceptable-use", label: "Acceptable Use Policy" },
      ]}
    />
  );
}
