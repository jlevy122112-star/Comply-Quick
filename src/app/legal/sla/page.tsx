import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Support SLA - Comply-Quick",
  description: "Support response targets, maintenance practices, and escalation for Comply-Quick.",
};

export default function SupportSlaPage() {
  return (
    <LegalDocumentLayout
      title="Support Service Levels"
      description="Operational support targets for customer inquiries, technical incidents, and escalation handling."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "definitions",
          heading: "1. Definitions and Scope",
          body: [
            "This Support SLA describes operational targets for paid customers. “Business hours” means the support team’s ordinary working hours on business days, excluding U.S. federal holidays. A “business day” is a day on which the support team ordinarily operates.",
            "Targets are goals for initial human response and triage, not guaranteed resolution times or uptime warranties, unless a signed enterprise agreement expressly says otherwise.",
          ],
        },
        {
          id: "channels",
          heading: "2. Support Channels and Severity",
          body: [
            `Primary support is available at ${SUPPORT_EMAIL}. Include the account, affected workflow, severity, timestamps, and reproducible steps.`,
          ],
          unorderedList: [
            "Critical: suspected security incident, broad production outage, or material loss of core access.",
            "High: significant production degradation with no reasonable workaround.",
            "Normal: individual defects, questions, configuration issues, or requests with an available workaround.",
          ],
        },
        {
          id: "targets",
          heading: "3. Initial Response Targets",
          body: [
            "Enterprise: priority response target within 4 business hours.",
            "Agency: response target within 8 business hours.",
            "Single and standard tiers: response target within 1 business day.",
            "We may reclassify a request when facts show that its initial severity was inaccurate. Status updates depend on the nature and duration of the incident.",
          ],
        },
        {
          id: "availability",
          heading: "4. Availability and Maintenance",
          body: [
            "We aim to keep the hosted service available and operational, but do not promise a specific uptime percentage under this public SLA. Availability can be affected by third-party infrastructure, internet access, customer configuration, and events outside reasonable control.",
            "We may perform planned maintenance, preferably with reasonable advance notice when practical. Emergency maintenance may occur without advance notice to protect security, reliability, or data integrity.",
          ],
        },
        {
          id: "exclusions",
          heading: "5. Exclusions",
          body: ["Support targets do not apply to delays caused by:"],
          unorderedList: [
            "Customer systems, credentials, configurations, integrations, or failure to provide requested information.",
            "Third-party services, internet or telecommunications failures, or unsupported environments.",
            "Abuse, security restrictions, force majeure, legal requirements, or scheduled maintenance.",
            "Beta, trial, free, or expressly unsupported features unless an order form states otherwise.",
          ],
        },
        {
          id: "enterprise",
          heading: "6. Enterprise Terms and Credits",
          body: [
            "An enterprise order form may provide different support hours, response commitments, uptime terms, service credits, or escalation contacts. The signed enterprise agreement controls if it conflicts with this page.",
            "No service credit or remedy is available under this public SLA unless expressly stated in a signed agreement. Customers must submit any contractual credit request within the period specified in that agreement.",
          ],
        },
        {
          id: "contact",
          heading: "7. Contact",
          body: [
            `Contact ${SUPPORT_EMAIL} for support and escalation. Put SECURITY in the subject line for vulnerability reports.`,
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/security", label: "Security Policy" },
        { href: "/legal/subscription", label: "Subscription and Cancellation" },
      ]}
    />
  );
}
