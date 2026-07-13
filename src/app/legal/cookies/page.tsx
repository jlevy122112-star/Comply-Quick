import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";

export const metadata: Metadata = {
  title: "Cookie Notice — Comply-Quick",
  description: "How Comply-Quick uses cookies, consent preferences, and global privacy controls.",
};

export default function CookieNoticePage() {
  return (
    <LegalDocumentLayout
      title="Cookie Notice"
      description="This notice explains cookie and tracking technologies used by Comply-Quick and how users can control preferences."
      effectiveDate="July 12, 2026"
      version="2026-07-12"
      sections={[
        {
          id: "cookie-categories",
          heading: "1. Cookie Categories",
          body: [
            "Comply-Quick uses strictly necessary cookies for authentication and platform security. Optional cookies may be used for analytics, product improvement, and attribution.",
            "Advertising and retargeting technologies are only used where configured and legally permitted.",
          ],
        },
        {
          id: "consent-controls",
          heading: "2. Consent and Preference Controls",
          body: [
            "Users can manage optional cookie categories through consent controls available in-product and on public pages where applicable.",
            "Where required by law, optional cookies are disabled until valid consent is captured.",
          ],
        },
        {
          id: "gpc-signals",
          heading: "3. Global Privacy Signals",
          body: [
            "Comply-Quick is designed to honor relevant browser privacy signals where legally required, including opt-out signals for data sharing and targeted advertising contexts.",
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
