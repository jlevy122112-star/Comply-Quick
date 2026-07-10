import { TIER_CONFIG } from "@/lib/pricing";

// Server-rendered JSON-LD for rich results and stronger entity understanding.
// Emits Organization + WebSite + SoftwareApplication + FAQPage. The FAQ entries
// mirror the on-page FAQ so the structured data stays truthful to the content.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Is Comply-Quick a substitute for a lawyer?",
    a: "No. Comply-Quick is compliance software, not a law firm, and its output does not constitute legal advice. It maps your tech stack to the right clauses, waivers, and checklist so that if you involve counsel, you hand them a finished draft instead of a blank page.",
  },
  {
    q: "What do I get with Comply-Quick?",
    a: "A complete compliance package: an inward liability waiver (developer to merchant), a website privacy policy with per-pixel disclosures, a jurisdiction-aware compliance checklist, and a shareable, embeddable compliance score badge. Everything is downloadable as markdown.",
  },
  {
    q: "How is the free preview different from paid plans?",
    a: "The free preview shows your compliance score and a look at your contract shield. Paid plans unlock the full downloadable package, more monthly scans, automated regulatory updates, and (on Enterprise) HIPAA, PCI-DSS, SOC 2, and ADA modules plus API access.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Plans are month-to-month and you can cancel from your dashboard in one click. Every plan is backed by a 30-day money-back guarantee.",
  },
  {
    q: "Which platforms and regions does Comply-Quick support?",
    a: "9 platforms (Shopify, WooCommerce, BigCommerce, WordPress, Next.js, Webflow, Wix, Squarespace, GoDaddy), 6 tracking pixels, and 6 jurisdictions (US, CCPA, GDPR, PIPEDA, LGPD, Australia), with enterprise modules for HIPAA, PCI-DSS, ADA/WCAG, and SOC 2.",
  },
];

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
        mainEntity: FAQ.map((item) => ({
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
