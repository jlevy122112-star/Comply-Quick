import type { Metadata } from "next";
import { LegalDocumentLayout } from "@/components/legal/LegalDocumentLayout";
import { LEGAL_EFFECTIVE_DATE, LEGAL_VERSION, SUPPORT_EMAIL } from "@/lib/company";

export const metadata: Metadata = {
  title: "Accessibility Statement - Comply-Quick",
  description: "Accessibility commitment and support channels for Comply-Quick.",
};

export default function AccessibilityPage() {
  return (
    <LegalDocumentLayout
      title="Accessibility Statement"
      description="Comply-Quick is committed to accessible, inclusive product and public-web experiences."
      effectiveDate={LEGAL_EFFECTIVE_DATE}
      version={LEGAL_VERSION}
      sections={[
        {
          id: "commitment",
          heading: "1. Our Commitment",
          body: [
            "We design and maintain Comply-Quick to support people with varied abilities, devices, input methods, and assistive technologies.",
            "Our target is substantial conformance with the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA. This is an ongoing engineering and content goal, not a representation that every page or third-party component is currently fully conformant.",
          ],
        },
        {
          id: "measures",
          heading: "2. Accessibility Measures",
          body: ["Our accessibility work may include:"],
          unorderedList: [
            "Semantic headings, landmarks, labels, focus states, keyboard navigation, and descriptive link text.",
            "Color and contrast review, responsive layouts, text alternatives, and reduced-motion considerations where appropriate.",
            "Automated checks, manual keyboard review, assistive-technology testing, and regression review as product changes are released.",
            "Accessible support workflows and remediation tracking for reported barriers.",
          ],
        },
        {
          id: "limitations",
          heading: "3. Known Limitations and Third Parties",
          body: [
            "Some older content, generated customer content, browser combinations, or third-party integrations may not yet provide the same experience. We prioritize barriers by severity, reach, and impact and may offer an alternative path while remediation is underway.",
            "Third-party websites and services linked from Comply-Quick are controlled by their operators. We cannot guarantee their accessibility, but we welcome reports about barriers encountered through our links or integrations.",
          ],
        },
        {
          id: "feedback",
          heading: "4. Feedback and Escalation",
          body: [
            `Report an accessibility barrier to ${SUPPORT_EMAIL}. Please include the page or workflow, a description of the barrier, your browser or assistive technology if relevant, and a preferred communication method.`,
            "We will review reports, request clarification when useful, and route actionable issues to the responsible product team. Feedback about an urgent inability to access account or security functions will be prioritized.",
          ],
        },
      ]}
      relatedLinks={[
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/legal/notices", label: "Legal Notices" },
      ]}
    />
  );
}
