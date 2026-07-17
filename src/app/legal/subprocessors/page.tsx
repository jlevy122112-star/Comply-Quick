import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Subprocessor Transparency - Comply-Quick",
  description: "Current subprocessor categories, providers, and change-notice commitments for Comply-Quick.",
};

export default function SubprocessorsPage() {
  return (
    <LegalDocumentLayout
      title="Subprocessor Transparency"
      description="Providers that Comply-Quick uses to operate customer-impacting services, current as of the effective date above."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "overview",
          heading: "1. Overview",
          body: [
            "Comply-Quick uses specialized providers to host, secure, monitor, bill, and improve the service. This page lists providers that may process personal data on our behalf; detection targets and vendors that customers may discover in their own websites are not automatically Comply-Quick subprocessors.",
            "The list is current as of the effective date and may change as the service, risk profile, or contractual requirements change.",
          ],
        },
        {
          id: "providers",
          heading: "2. Current Providers",
          subsections: [
            {
              heading: "Supabase",
              body: [
                "Purpose: authentication, database, storage, and related application infrastructure. Data categories: account, authentication, organization, customer-submitted, audit, and operational data. Region: service-region dependent; customers may request current transfer documentation.",
              ],
            },
            {
              heading: "Stripe",
              body: [
                "Purpose: subscription billing, payment processing, invoices, and billing administration. Data categories: billing contact, subscription, transaction, and limited payment metadata. Region: service-region dependent.",
              ],
            },
            {
              heading: "OpenAI",
              body: [
                "Purpose: enabled artificial-intelligence features such as assistant, analysis, or automation workflows. Data categories: prompts, responses, and customer-provided context submitted to those features. Region: service-region dependent; use is subject to applicable product configuration and provider terms.",
              ],
            },
            {
              heading: "Sentry",
              body: [
                "Purpose: application error monitoring, diagnostics, and reliability operations. Data categories: diagnostic events, technical identifiers, request context, and limited account or organization metadata. Region: service-region dependent.",
              ],
            },
            {
              heading: "Vercel",
              body: [
                "Purpose: application hosting, deployment, edge delivery, and runtime operations. Data categories: request, device, technical, authentication, and application data handled by hosted routes. Region: service-region dependent.",
              ],
            },
          ],
        },
        {
          id: "safeguards",
          heading: "3. Contractual and Security Safeguards",
          body: [
            "We require subprocessors to process data only for authorized purposes and to maintain confidentiality and appropriate security obligations. We evaluate providers based on service need, data minimization, security posture, and contractual protections.",
            "The DPA describes processor obligations, assistance, breach handling, transfers, and audit information. The Security Policy describes Comply-Quick’s program at a high level.",
          ],
        },
        {
          id: "changes",
          heading: "4. Changes and Objections",
          body: [
            "We may add, remove, or replace a subprocessor. Where a customer agreement requires advance notice, we will provide notice through the service, email, or another reasonable channel before the change takes effect.",
            "A customer with a contractual objection right must submit a specific, documented objection to the support address within the applicable notice period. We will review the objection in good faith and may offer a commercially reasonable alternative, mitigation, or termination right where the contract requires it.",
          ],
        },
        {
          id: "contact",
          heading: "5. Contact",
          body: [`Questions about subprocessors or transfer documentation may be sent to ${SUPPORT_EMAIL}.`],
        },
      ]}
      relatedLinks={[
        { href: "/legal/dpa", label: "Data Processing Addendum" },
        { href: "/legal/privacy", label: "Privacy Policy" },
      ]}
    />
  );
}
