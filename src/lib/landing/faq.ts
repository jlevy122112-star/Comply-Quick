/**
 * Single source of truth for the landing-page FAQ.
 *
 * Both the visible FAQ (src/app/page.tsx) and the FAQPage JSON-LD
 * (src/components/seo/StructuredData.tsx) render from this list so the
 * structured data can never drift from the on-page content — a requirement
 * of Google's FAQPage guidelines.
 */
export interface LandingFaqEntry {
  /** Question text (Title Case, matching the visible copy). */
  q: string;
  /** Plain-text answer, kept in sentence case. */
  a: string;
}

export const LANDING_FAQ: LandingFaqEntry[] = [
  {
    q: "Is This a Substitute for a Lawyer?",
    a: "No. Comply-Quick is compliance software, not a law firm, and its output does not constitute legal advice. It does the heavy lifting — mapping your stack to the right clauses, waivers, and checklist — so that if you do involve counsel, you hand them a finished draft instead of a blank page.",
  },
  {
    q: "What Do I Actually Get?",
    a: "A complete package: an inward liability waiver (developer → merchant), a store privacy policy with per-pixel disclosures, a jurisdiction-aware compliance checklist, and a compliance score you can share or embed as a badge. You can download everything as markdown.",
  },
  {
    q: "How Does the Automated Regulation Monitoring Work?",
    a: "Comply-Quick monitors 26+ official federal and state regulatory sources directly. When a rule changes, the AI Compliance Agent alerts you and automatically re-drafts the affected documents plus an implementation strategy, ready for you to review and publish. Comply-Quick prepares the updates — you decide what goes live on the site.",
  },
  {
    q: "How Is the Free Preview Different From Paid?",
    a: "The free preview shows your compliance score and a look at your contract shield so you can judge the value first. Paid plans unlock the full downloadable package, more monthly scans, automated regulatory updates, and (on Enterprise) HIPAA/PCI-DSS/SOC 2/ADA modules and a dedicated AI Compliance Agent.",
  },
  {
    q: "Can I Cancel Anytime?",
    a: "Yes — plans are month-to-month and you can cancel from your dashboard in one click. Every plan is also backed by a 30-day money-back guarantee, no questions asked.",
  },
  {
    q: "Which Platforms and Regions Are Supported?",
    a: "9 platforms (Shopify, WooCommerce, BigCommerce, WordPress, Next.js, Webflow, Wix, Squarespace, GoDaddy), 6 tracking pixels, and 6 jurisdictions (US, CCPA, GDPR, PIPEDA, LGPD, Australia) — with enterprise modules for HIPAA, PCI-DSS, ADA/WCAG and SOC 2.",
  },
];
