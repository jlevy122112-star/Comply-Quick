import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Acceptable Use Policy — Comply-Quick",
  description: "Rules for acceptable platform usage and prohibited activity on Comply-Quick.",
};

export default function AcceptableUsePolicyPage() {
  return (
    <LegalDocumentLayout
      title="Acceptable Use Policy"
      description="This policy outlines prohibited behavior and usage safeguards to protect Comply-Quick users, systems, and data."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "prohibited-activity",
          heading: "1. Prohibited Activity",
          body: [
            "Users must not attempt unauthorized access, reverse-engineer protected systems, interfere with service operations, or upload malicious payloads.",
            "Use of Comply-Quick to facilitate unlawful activity, deceptive practices, or rights violations is prohibited.",
          ],
        },
        {
          id: "data-integrity",
          heading: "2. Data Integrity and Security Expectations",
          body: [
            "Users are responsible for maintaining secure credentials and promptly notifying Comply-Quick about suspected account compromise.",
            "Customers must avoid uploading data they are not legally permitted to process through the service.",
          ],
        },
        {
          id: "enforcement",
          heading: "3. Enforcement",
          body: [
            "Comply-Quick may investigate policy violations and suspend or terminate access to protect platform integrity.",
            "Severe or repeated violations may result in immediate account action and legal escalation where necessary.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/security", label: "Security Policy" },
      ]}
    />
  );
}
