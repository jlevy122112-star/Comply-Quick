import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import {
  COMPANY_LEGAL_NAME,
  GOVERNING_LAW_CLAUSE,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_VERSION,
  SUPPORT_EMAIL,
} from "@/lib/company";

export const metadata: Metadata = {
  title: "Legal Notices - Comply-Quick",
  description: "Legal notices, disclaimers, trademarks, jurisdictional context, and formal contact information.",
};

export default function LegalNoticesPage() {
  return (
    <LegalDocumentLayout
      title="Legal Notices and Disclaimers"
      description="Important notices concerning Comply-Quick’s services, generated content, intellectual property, and legal communications."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "no-advice",
          heading: "1. No Legal Advice",
          body: [
            "Comply-Quick provides automated operational templates, compliance tooling, and technical workflow assistance. It is not a law firm, does not provide formal legal counsel, and does not create an attorney-client relationship.",
            "Generated content is informational only. You are responsible for validating inputs, reviewing outputs with qualified counsel, and determining whether content is appropriate for your circumstances, industry, customers, and jurisdictions.",
          ],
        },
        {
          id: "intellectual-property",
          heading: "2. Trademarks and Third-Party Marks",
          body: [
            `${COMPANY_LEGAL_NAME} owns or licenses the Comply-Quick name, logos, interfaces, and related marks. You may not use our marks in a way that implies endorsement, sponsorship, or affiliation without written permission.`,
            "Third-party names, logos, products, and marks are the property of their respective owners. Their appearance in generated or informational materials does not imply endorsement or partnership.",
          ],
        },
        {
          id: "regulatory-scope",
          heading: "3. Regulatory and Jurisdictional Scope",
          body: [
            "Comply-Quick serves customers across multiple jurisdictions. Legal requirements vary based on customer location, audience, data, technology, and processing context. A regulatory reference or generated clause is not a guarantee that every applicable requirement has been identified.",
            "We may track state, federal, and international developments as part of our product program, but customers must obtain current legal advice for consequential decisions.",
          ],
        },
        {
          id: "louisiana",
          heading: "4. Louisiana Operational Context",
          body: [
            "Comply-Quick is anchored in Louisiana, USA. We track Louisiana operational considerations, including data-breach response requirements such as La. R.S. 51:3071 et seq., when relevant to the service and our legal review process.",
            "The Terms of Service contain the binding governing-law, arbitration, class-action waiver, and venue provisions. This notice does not replace those provisions.",
          ],
        },
        {
          id: "communications",
          heading: "5. Formal Communications",
          body: [
            `Send legal notices, compliance requests, counsel communications, or requests for a signed enterprise document to ${SUPPORT_EMAIL} with a clear subject line and sufficient information for routing.`,
            "Email delivery is not complete until received by an authorized recipient. Do not send highly sensitive information unless a secure channel has been arranged.",
          ],
        },
        {
          id: "governing-law",
          heading: "6. Governing-Law Reference",
          body: [GOVERNING_LAW_CLAUSE],
        },
      ]}
      relatedLinks={[
        { href: "/legal/terms", label: "Terms of Service" },
        { href: "/legal/packet", label: "Counsel Review Packet" },
      ]}
    />
  );
}
