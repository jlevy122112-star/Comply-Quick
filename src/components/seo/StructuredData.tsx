import { TIER_CONFIG } from "@/lib/pricing";

// Server-rendered JSON-LD for rich results and stronger entity understanding.
// Emits Organization + WebSite + SoftwareApplication + FAQPage. The FAQ entries
// mirror the on-page FAQ so the structured data stays truthful to the content.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";

// Mirrors the on-page FAQ (questions + answers) 1:1 so the rich-result markup
// matches the visible content, per Google's FAQPage guidelines.
const FAQ: { q: string; a: string }[] = [
  {
    q: "Is This A Substitute For A Lawyer?",
    a: "No. Comply-Quick is compliance software, not a law firm, and its output does not constitute legal advice. It does the heavy lifting — mapping your stack to the right clauses, waivers, and checklist — so that if you do involve counsel, you hand them a finished draft instead of a blank page.",
  },
  {
    q: "What Do I Actually Get?",
    a: "A complete package: an inward liability waiver (developer → merchant), a store privacy policy with per-pixel disclosures, a jurisdiction-aware compliance checklist, and a compliance score you can share or embed as a badge. You can download everything as markdown.",
  },
  {
    q: "How Does The Automated Regulation Monitoring Work?",
    a: "Comply-Quick monitors 26+ official federal and state regulatory sources directly. When a rule changes, the AI Compliance Agent alerts you and automatically re-drafts the affected documents plus an implementation strategy, ready for you to review and publish. Comply-Quick prepares the updates — you decide what goes live on the site.",
  },
  {
    q: "How Is The Free Preview Different From Paid?",
    a: "The free preview shows your compliance score and a look at your contract shield so you can judge the value first. Paid plans unlock the full downloadable package, more monthly scans, automated regulatory updates, and (on Enterprise) HIPAA/PCI-DSS/SOC 2/ADA modules and a dedicated AI Compliance Agent.",
  },
  {
    q: "Can I Cancel Anytime?",
    a: "Yes — plans are month-to-month and you can cancel from your dashboard in one click. Every plan is also backed by a 30-day money-back guarantee, no questions asked.",
  },
  {
    q: "Which Platforms And Regions Are Supported?",
    a: "9 platforms (Shopify, WooCommerce, BigCommerce, WordPress, Next.js, Webflow, Wix, Squarespace, GoDaddy), 6 tracking pixels, and 6 jurisdictions (US, CCPA, GDPR, PIPEDA, LGPD, Australia) — with enterprise modules for HIPAA, PCI-DSS, ADA/WCAG and SOC 2.",
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
