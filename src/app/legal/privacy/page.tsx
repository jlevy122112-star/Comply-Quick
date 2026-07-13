import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import type { LegalSection } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Comply-Quick",
  description: "How Comply-Quick collects, uses, protects, and manages personal information and data rights requests.",
  alternates: {
    canonical: "/legal/privacy",
  },
};

export default function PrivacyPolicyPage() {
  const sections: LegalSection[] = [
    {
      id: "overview",
      heading: "1. Overview",
      body: [
        "Comply-Quick collects account, billing, product usage, and support data to deliver secure compliance workflows and customer support.",
        "We do not sell personal information. We use data to operate the platform, prevent abuse, improve reliability, and meet legal obligations.",
      ],
    },
    {
      id: "data-categories",
      heading: "2. Data Categories We Process",
      body: [
        "We process identity and contact data, account credentials, billing and subscription metadata, operational telemetry, support communications, and audit events.",
        "When customers use Comply-Quick in agency or enterprise mode, they control the content they submit for generated outputs.",
      ],
    },
    {
      id: "lawful-basis",
      heading: "3. Legal Bases and Purposes",
      body: [
        "We process data to provide contracted services, secure accounts, process payments, communicate service notices, and maintain compliance records.",
        "Where required by law, we rely on consent for optional analytics and communications, and provide withdrawal controls.",
      ],
    },
    {
      id: "rights",
      heading: "4. Your Privacy Rights",
      body: [
        "Depending on your jurisdiction, you may request access, correction, deletion, portability, or restriction of personal data. You may also opt out of certain processing where applicable.",
        "To submit a request, contact support@comply-quick.com and include enough information for identity verification.",
      ],
    },
    {
      id: "retention-security",
      heading: "5. Retention and Security",
      body: [
        "We retain data only for as long as needed to provide services, satisfy legal obligations, and support legitimate business needs.",
        "Comply-Quick applies technical and organizational safeguards including access control, encryption in transit, and operational monitoring.",
      ],
    },
  ];

  return (
    <LegalDocumentLayout
      title="Privacy Policy"
      description="This Privacy Policy explains how Comply-Quick processes personal data across account creation, compliance generation, support, and billing operations."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={sections}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/cookies", label: "Cookie Notice" },
        { href: "/legal/security", label: "Security Policy" },
      ]}
    />
  );
}
