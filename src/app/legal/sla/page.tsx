import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Support SLA — Comply-Quick",
  description: "Comply-Quick support response targets, channels, and escalation workflow.",
};

export default function SupportSlaPage() {
  return (
    <LegalDocumentLayout
      title="Support SLA"
      description="Comply-Quick support service-level targets for customer inquiries, technical incidents, and escalation handling."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "support-channels",
          heading: "1. Support Channels",
          body: [
            "Primary support channel: support@comply-quick.com. Customers should include account details, severity, and reproducible steps for faster triage.",
            "Security disclosures should include SECURITY in the subject line.",
          ],
        },
        {
          id: "response-targets",
          heading: "2. Initial Response Targets",
          body: [
            "Enterprise: priority response target within 4 business hours. Agency: within 8 business hours. Single/standard tiers: within 1 business day.",
            "These are operational targets, not guaranteed uptime warranties, unless superseded by a signed enterprise agreement.",
          ],
        },
        {
          id: "escalation",
          heading: "3. Escalation Workflow",
          body: [
            "Urgent incidents are triaged by severity and escalated to on-call engineering when production impact is detected.",
            "Customers receive status updates during active incident handling until mitigation and closure.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/security", label: "Security Policy" },
        { href: "/legal/subscription", label: "Subscription & Cancellation" },
      ]}
    />
  );
}
