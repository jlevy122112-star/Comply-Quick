import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Acceptable Use Policy - Comply-Quick",
  description: "Rules for acceptable platform usage and prohibited activity on Comply-Quick.",
};

export default function AcceptableUsePage() {
  return (
    <LegalDocumentLayout
      title="Acceptable Use Policy"
      description="This policy protects Comply-Quick users, systems, data, and the integrity of compliance workflows."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "scope",
          heading: "1. Scope and Responsible Use",
          body: [
            "This policy applies to every person and organization using Comply-Quick, including account owners, invited users, agency personnel, and people accessing public outputs.",
            "You may use the service only for lawful business, compliance, security, and operational purposes and only in accordance with the Terms of Service.",
          ],
          unorderedList: [
            "Maintain accurate account and billing information.",
            "Use the service only with data and permissions you are authorized to provide.",
            "Protect credentials and promptly report suspected compromise to the support address below.",
          ],
        },
        {
          id: "prohibited-activity",
          heading: "2. Prohibited Activity",
          body: ["You must not use the service to:"],
          unorderedList: [
            "Break the law, facilitate fraud or deception, infringe intellectual-property or privacy rights, or evade regulatory obligations.",
            "Attempt unauthorized access, probe or defeat security controls, reverse-engineer protected systems, or interfere with service operations.",
            "Upload malware, harmful code, unlawful material, or data you are not legally permitted to process.",
            "Scrape, resell, frame, mirror, or systematically extract the service or outputs except as expressly authorized.",
            "Generate or distribute content intended to impersonate, harass, discriminate against, threaten, or harm another person.",
            "Use automated traffic in a manner that creates unreasonable load, bypasses rate limits, or interferes with other customers.",
          ],
        },
        {
          id: "enforcement",
          heading: "3. Monitoring and Enforcement",
          body: [
            "We may investigate suspected violations using reasonable technical and administrative measures. We may preserve evidence, restrict functionality, suspend access, or terminate an account when necessary to protect people, systems, customers, or legal rights.",
            "We will consider the severity, intent, history, and actual or threatened harm of a violation. Nothing in this policy limits our right to seek emergency or other lawful relief.",
          ],
          subsections: [
            {
              heading: "Security and Legal Requests",
              body: [
                `Report suspected abuse or urgent security concerns to ${SUPPORT_EMAIL}. We may disclose information when reasonably necessary to comply with law, enforce this policy, or protect rights and safety.`,
              ],
            },
          ],
        },
        {
          id: "contact",
          heading: "4. Contact",
          body: [`Questions about this policy may be sent to ${SUPPORT_EMAIL}.`],
        },
      ]}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/security", label: "Security Policy" },
      ]}
    />
  );
}
