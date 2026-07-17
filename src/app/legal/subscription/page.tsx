import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Subscription and Cancellation Policy - Comply-Quick",
  description: "Subscription billing, renewal, cancellation, refunds, and payment terms for Comply-Quick.",
};

export default function SubscriptionPage() {
  return (
    <LegalDocumentLayout
      title="Subscription and Cancellation Policy"
      description="Billing, renewals, cancellation workflow, refunds, trials, taxes, and payment responsibilities for Comply-Quick."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "plans",
          heading: "1. Plans and Billing Cycles",
          body: [
            "Comply-Quick offers the plans, limits, features, and prices displayed at checkout or in an applicable order form. A plan may be monthly, annual, usage-based, or otherwise described at purchase.",
            "The checkout summary and order form identify the billing cycle, currency, taxes, included limits, and any promotional terms. Enterprise terms may be customized in a signed order form.",
          ],
        },
        {
          id: "renewal",
          heading: "2. Payment and Auto-Renewal",
          body: [
            "Paid plans renew automatically for the selected billing interval unless canceled before the renewal date. You authorize the payment method and our payment processor to charge recurring fees, applicable taxes, and approved usage or overage amounts.",
            "Keep billing information current. Failed payments may result in notice, retries, restricted features, suspension, or termination after reasonable opportunity to cure.",
          ],
        },
        {
          id: "price-changes",
          heading: "3. Price and Plan Changes",
          body: [
            "We may change prices, plans, limits, or features prospectively. We will provide notice where required and will not retroactively change a committed order-form price unless the order form permits it.",
            "Continuing a subscription after a new price becomes effective constitutes acceptance of the new price, subject to any cancellation rights provided by law or contract.",
          ],
        },
        {
          id: "cancellation",
          heading: "4. Cancellation",
          body: [
            "You may cancel through the available account or billing settings, or by contacting support when self-service is unavailable. Cancellation normally takes effect at the end of the current paid period, and access may continue until then unless the account is suspended for another reason.",
            "Cancellation does not erase amounts already incurred, usage-based charges, taxes, or non-cancellable order-form commitments.",
          ],
        },
        {
          id: "refunds",
          heading: "5. Refunds, Trials, and Guarantees",
          body: [
            "Refund eligibility follows the guarantee, trial, or promotional terms shown at purchase. If no guarantee applies, payments are generally non-refundable except where required by law or approved by us in our discretion.",
            "Trial access may convert to a paid subscription if the checkout disclosure says so. We may limit, suspend, or discontinue a trial for misuse or abuse.",
            `Submit a refund request to ${SUPPORT_EMAIL} with the account, transaction, and reason. Do not initiate a payment dispute while a good-faith refund review is pending.`,
          ],
        },
        {
          id: "taxes-chargebacks",
          heading: "6. Taxes and Chargebacks",
          body: [
            "Prices may exclude sales, use, value-added, withholding, or similar taxes unless stated otherwise. You are responsible for taxes applicable to your purchase, excluding taxes based on our net income.",
            "Unauthorized chargebacks or payment reversals may trigger account restrictions. We will investigate disputed charges and pursue lawful remedies for amounts properly owed.",
          ],
        },
        {
          id: "contact",
          heading: "7. Contact and Incorporated Terms",
          body: [
            "This Policy is part of the Terms of Service. If an order form conflicts with this Policy, the signed order form controls for that conflict.",
            `Billing questions may be sent to ${SUPPORT_EMAIL}.`,
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
