import { TIER_CONFIG } from "@/lib/pricing";
import { LANDING_FAQ } from "@/lib/landing/faq";

// Server-rendered JSON-LD for rich results and stronger entity understanding.
// Emits Organization + WebSite + SoftwareApplication + FAQPage. The FAQ entries
// come from the shared LANDING_FAQ source so the structured data can never drift
// from the on-page content.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";

export function StructuredData() {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: "Comply-Quick",
        url: SITE_URL,
        description:
          "Compliance platform that scans a website's tech stack and auto-generates the privacy policy, liability waivers, and pre-launch checklist it needs.",
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: "Comply-Quick",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "SoftwareApplication",
        name: "Comply-Quick",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: SITE_URL,
        description:
          "Scan any website for GDPR, CCPA, and ADA risk and auto-generate stack-aware privacy policies, cookie disclosures, liability waivers, and a pre-launch compliance checklist in under a minute.",
        featureList: [
          "One-click tech-stack and tracker detection",
          "Auto-generated privacy policy and cookie disclosures",
          "Developer-to-merchant liability waiver",
          "Jurisdiction-aware compliance checklist",
          "Automated regulatory-change monitoring across official sources",
          "White-label export for agencies",
          "Embeddable compliance score badge",
        ],
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: String(TIER_CONFIG.solo.monthly),
          highPrice: String(TIER_CONFIG.enterprise.monthly),
          offerCount: "3",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${SITE_URL}/#faq`,
        mainEntity: LANDING_FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inject; there is no user input in the graph.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
