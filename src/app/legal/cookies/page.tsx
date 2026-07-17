import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Cookie Notice - Comply-Quick",
  description: "How Comply-Quick uses cookies, consent preferences, and privacy signals.",
};

export default function CookiesPage() {
  return (
    <LegalDocumentLayout
      title="Cookie Notice"
      description="This notice explains cookies and similar technologies used by Comply-Quick and how preferences can be controlled."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "what-cookies-are",
          heading: "1. What Cookies Are",
          body: [
            "Cookies are small text files stored by a browser. Similar technologies, such as local storage, pixels, SDKs, and server-side identifiers, may perform related functions.",
            "We use these technologies to authenticate accounts, keep the service secure, remember preferences, understand product performance, and support communications or attribution where configured and permitted.",
          ],
        },
        {
          id: "categories",
          heading: "2. Cookie Categories",
          subsections: [
            {
              heading: "Strictly Necessary",
              body: [
                "Authentication, session integrity, fraud prevention, security, routing, and consent-state cookies. These generally persist for a session or for the period needed to maintain account security.",
              ],
            },
            {
              heading: "Functional",
              body: [
                "Preferences and interface settings that improve usability. These may persist for a defined preference period or until you clear them.",
              ],
            },
            {
              heading: "Analytics",
              body: [
                "Measurement of page performance, feature use, errors, and aggregate product activity. Retention varies by provider and configuration.",
              ],
            },
            {
              heading: "Advertising and Attribution",
              body: [
                "Campaign attribution or advertising measurement when enabled for a particular experience. Comply-Quick does not activate optional advertising technologies where consent or another lawful basis is required and unavailable.",
              ],
            },
          ],
        },
        {
          id: "controls",
          heading: "3. Consent and Privacy Controls",
          body: [
            "Where required by law, optional technologies remain disabled until valid consent is captured. You can change available preferences through the consent controls presented in the relevant experience.",
            "We are designed to honor applicable browser privacy signals, including Global Privacy Control (GPC), where legally required. Signal handling may depend on the browser, jurisdiction, and technology category.",
          ],
        },
        {
          id: "third-party",
          heading: "4. Third-Party Technologies",
          body: [
            "Service providers may place or access identifiers on our behalf for hosting, authentication, payments, error monitoring, communications, or product operations. The Subprocessor Transparency page identifies providers used for customer-impacting processing.",
            "Third-party sites linked from Comply-Quick may use their own cookies under their own notices. We do not control those practices.",
          ],
        },
        {
          id: "manage",
          heading: "5. Managing Cookies and Contact",
          body: [
            "Most browsers allow you to block or delete cookies. Blocking strictly necessary cookies can prevent login or core functionality. Browser settings do not necessarily withdraw consent already recorded in a separate consent system.",
            `Questions about this notice or a privacy preference request may be sent to ${SUPPORT_EMAIL}.`,
          ],
        },
        {
          id: "changes",
          heading: "6. Changes",
          body: [
            "We may update this notice when technologies, legal requirements, or service practices change. The effective date and version above identify the current published notice.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/legal/subprocessors", label: "Subprocessor Transparency" },
      ]}
    />
  );
}
