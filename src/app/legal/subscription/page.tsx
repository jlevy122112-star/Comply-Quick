import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Subscription & Cancellation Policy — Comply-Quick",
  description: "Subscription billing terms, cancellation process, and refund handling for Comply-Quick.",
};

export default function SubscriptionPolicyPage() {
  return (
    <LegalDocumentLayout
      title="Subscription and Cancellation Policy"
      description="This policy explains Comply-Quick subscription billing, renewals, cancellation workflow, and refund handling standards."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "billing",
          heading: "1. Billing and Renewal",
          body: [
            "Paid plans renew automatically on the billing interval selected at checkout unless canceled before renewal.",
            "Billing receipts and subscription updates are sent to the account billing contact.",
          ],
        },
        {
          id: "cancellation",
          heading: "2. Cancellation Process",
          body: [
            "Customers can cancel directly from account settings and billing flows without requiring support intervention.",
            "Cancellation is designed to be straightforward and at least as easy as signup for online users.",
          ],
        },
        {
          id: "refunds",
          heading: "3. Refunds",
          body: [
            "Where a plan includes an explicit money-back guarantee, eligibility follows the terms shown at purchase.",
            "Refund requests not covered by a guarantee are reviewed case-by-case. Contact support@comply-quick.com with account details and request context.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/sla", label: "Support SLA" },
      ]}
    />
  );
}
