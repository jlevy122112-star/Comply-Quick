// [Up12] SEO content engine — blog post content model + articles.
//
// Posts are stored as typed, structured data (not MDX) so they render as
// fully server-side HTML with zero client JS and no extra build deps. Paragraph
// text supports a tiny inline syntax handled by the renderer: `[label](/path)`
// for links (internal links use next/link) and `**bold**`.

export type BlogBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  /** Meta description (~150–160 chars). */
  description: string;
  keywords: string[];
  category: string;
  author: string;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  updatedAt: string;
  body: BlogBlock[];
  /** Slugs of related posts for internal linking. */
  related: string[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "gdpr-compliance-checklist-shopify-stores",
    title: "GDPR Compliance Checklist for Shopify Stores",
    description:
      "A practical, step-by-step GDPR checklist for Shopify merchants: cookie consent, data subject rights, processor agreements, and the trackers that quietly break compliance.",
    keywords: [
      "GDPR Shopify",
      "Shopify compliance checklist",
      "GDPR cookie consent Shopify",
      "ecommerce GDPR",
      "Shopify privacy policy",
    ],
    category: "GDPR",
    author: "Comply-Quick",
    publishedAt: "2026-07-03",
    updatedAt: "2026-07-03",
    related: ["hidden-js-trackers-ccpa-fines", "privacy-policy-template-saas-founders"],
    body: [
      {
        type: "p",
        text: "If your Shopify store sells to or tracks anyone in the EU or UK, the GDPR applies to you — regardless of where your business is registered. The good news: most stores can reach a solid compliance baseline in an afternoon. This checklist walks through what actually matters, in priority order.",
      },
      { type: "h2", text: "1. Map what personal data you collect" },
      {
        type: "p",
        text: "Before anything else, inventory the personal data flowing through your store. On a typical Shopify store this includes:",
      },
      {
        type: "ul",
        items: [
          "Customer names, emails, shipping/billing addresses (checkout).",
          "Payment metadata via Shopify Payments / Stripe / PayPal.",
          "Behavioral data from analytics and ad pixels (Google Analytics, Meta Pixel, TikTok).",
          "Support and marketing data (Klaviyo, Mailchimp, live chat).",
        ],
      },
      {
        type: "callout",
        text: "Every third-party app with data access is a 'processor' under the GDPR. You are the 'controller' and remain responsible for what they do with your customers' data.",
      },
      { type: "h2", text: "2. Get cookie consent right (before the scripts fire)" },
      {
        type: "p",
        text: "The single most common GDPR failure on Shopify is loading analytics and ad trackers *before* the visitor consents. Consent must be freely given, specific, and opt-in — pre-ticked boxes and 'by using this site you agree' banners do not count.",
      },
      {
        type: "ol",
        items: [
          "Use Shopify's Customer Privacy API (or a certified consent app) so tracking scripts are blocked until consent.",
          "Offer a genuine 'Reject all' option with the same prominence as 'Accept all'.",
          "Log consent (who, when, what version) so you can prove it.",
        ],
      },
      {
        type: "p",
        text: "Not sure which trackers fire before consent on your store? Read [Hidden JS Trackers Costing You CCPA Fines](/blog/hidden-js-trackers-ccpa-fines) — the same detection applies to GDPR, or run an automated scan of your storefront (link below).",
      },
      { type: "h2", text: "3. Publish a compliant privacy policy" },
      {
        type: "p",
        text: "Your policy must name the data you collect, the legal basis, retention periods, the processors you share data with, and how customers exercise their rights. A generic template pulled off the internet usually misses the processor list and legal bases. If you also run a SaaS or app, see [Privacy Policy Template for SaaS Founders](/blog/privacy-policy-template-saas-founders).",
      },
      { type: "h2", text: "4. Honor data subject rights" },
      {
        type: "ul",
        items: [
          "Access & portability: be able to export a customer's data on request.",
          "Erasure: Shopify supports customer data redaction requests — have a documented process.",
          "Respond within one month; free of charge for the first request.",
        ],
      },
      { type: "h2", text: "5. Sign Data Processing Agreements (DPAs)" },
      {
        type: "p",
        text: "Shopify, your payment processor, and every marketing/analytics app should have a DPA. Most offer one in their settings or legal pages — collect and store them. If you use sub-processors outside the EU, confirm a valid transfer mechanism (e.g. Standard Contractual Clauses).",
      },
      { type: "h2", text: "The 10-minute version" },
      {
        type: "ol",
        items: [
          "Block trackers until opt-in consent (Reject all present).",
          "Publish a policy that lists processors + legal bases.",
          "Have an erasure/access process you can actually run.",
          "Collect DPAs from Shopify and every data app.",
          "Log consent and keep records.",
        ],
      },
    ],
  },
  {
    slug: "hidden-js-trackers-ccpa-fines",
    title: "Hidden JS Trackers Costing You CCPA Fines",
    description:
      "Third-party JavaScript trackers often sell or share data without your knowledge — triggering CCPA/CPRA 'sale' and 'share' obligations. Here's how to find and fix them.",
    keywords: [
      "CCPA trackers",
      "CPRA sale of data",
      "hidden JavaScript trackers",
      "Do Not Sell My Personal Information",
      "CCPA fines",
    ],
    category: "CCPA",
    author: "Comply-Quick",
    publishedAt: "2026-07-03",
    updatedAt: "2026-07-03",
    related: ["gdpr-compliance-checklist-shopify-stores", "privacy-policy-template-saas-founders"],
    body: [
      {
        type: "p",
        text: "Under the CCPA (as amended by the CPRA), sharing personal information with an ad network for cross-context behavioral advertising counts as a 'sale' or 'share' — even if no money changes hands. Most sites trigger this the moment a marketing pixel loads, and most owners have no idea it's happening.",
      },
      { type: "h2", text: "Why 'hidden' trackers are the real risk" },
      {
        type: "p",
        text: "You install one tag manager or one marketing app, and it silently loads a dozen downstream pixels. Each one may set identifiers and beacon data back to an ad network. Because they're injected at runtime by other scripts, they never appear in your source code — so a manual code review misses them entirely.",
      },
      {
        type: "ul",
        items: [
          "Meta Pixel, TikTok Pixel, Google Ads / Floodlight.",
          "Session-replay tools that record keystrokes and forms.",
          "Affiliate and attribution beacons piggybacking on other tags.",
        ],
      },
      {
        type: "callout",
        text: "The California AG's first major CCPA enforcement action centered on exactly this: a retailer using third-party trackers it hadn't disclosed as a 'sale', with no working opt-out.",
      },
      { type: "h2", text: "What the CCPA/CPRA requires once trackers are 'selling'" },
      {
        type: "ol",
        items: [
          "A clear 'Do Not Sell or Share My Personal Information' link on your homepage.",
          "Honor the Global Privacy Control (GPC) browser signal automatically.",
          "Disclose the categories of data shared and the categories of recipients in your privacy policy.",
        ],
      },
      { type: "h2", text: "How to find what's actually loading" },
      {
        type: "p",
        text: "You need a runtime scan — one that renders the page in a real browser and records every network request and script injection, not just the static HTML. That's the only way to catch trackers added by other trackers. Comply-Quick's scanner does exactly this; it renders your site headlessly and flags each tool that sets identifiers or beacons to ad networks.",
      },
      {
        type: "p",
        text: "Running an EU-facing store too? The same trackers create consent problems under the GDPR — see the [GDPR Compliance Checklist for Shopify Stores](/blog/gdpr-compliance-checklist-shopify-stores).",
      },
      { type: "h2", text: "Fix it in three steps" },
      {
        type: "ol",
        items: [
          "Scan to get the actual list of trackers and what they transmit.",
          "Add a working Do-Not-Sell/Share opt-out and honor GPC.",
          "Update your privacy policy to disclose the categories — then re-scan to confirm.",
        ],
      },
    ],
  },
  {
    slug: "privacy-policy-template-saas-founders",
    title: "Privacy Policy Template for SaaS Founders",
    description:
      "A founder-friendly privacy policy template covering the sections SaaS apps actually need — data collected, sub-processors, security, GDPR/CCPA rights — plus the mistakes to avoid.",
    keywords: [
      "SaaS privacy policy template",
      "privacy policy for startups",
      "GDPR CCPA privacy policy",
      "sub-processors list",
      "SaaS compliance",
    ],
    category: "Privacy Policy",
    author: "Comply-Quick",
    publishedAt: "2026-07-03",
    updatedAt: "2026-07-03",
    related: ["gdpr-compliance-checklist-shopify-stores", "hidden-js-trackers-ccpa-fines"],
    body: [
      {
        type: "p",
        text: "A privacy policy is the first legal document a SaaS founder needs — it's required by app stores, ad platforms, most integrations, and privacy law itself. But a copy-pasted template usually omits the two sections that matter most for SaaS: your sub-processor list and your legal bases. Here's a structure that holds up.",
      },
      { type: "h2", text: "The sections every SaaS policy needs" },
      {
        type: "ol",
        items: [
          "Who you are (controller identity + contact / DPO if applicable).",
          "What data you collect (account, usage/telemetry, billing, support).",
          "Why, and the legal basis (contract, legitimate interest, consent).",
          "Sub-processors you share data with (hosting, analytics, payments, email).",
          "International transfers and the mechanism (e.g. SCCs).",
          "Retention periods per data category.",
          "User rights (access, deletion, portability, objection) and how to exercise them.",
          "Security measures, breach process, and how you notify users.",
          "How you announce policy changes.",
        ],
      },
      {
        type: "callout",
        text: "The #1 omission: a maintained sub-processor list. If you use AWS, Stripe, and an analytics tool, name them — 'trusted third parties' is not a disclosure.",
      },
      { type: "h2", text: "Common mistakes founders make" },
      {
        type: "ul",
        items: [
          "Claiming you 'never share data' while running Meta/Google pixels — which is a 'sale/share' under CCPA. See [Hidden JS Trackers Costing You CCPA Fines](/blog/hidden-js-trackers-ccpa-fines).",
          "Reusing a US-only template while onboarding EU customers (no legal bases, no SCCs).",
          "Letting the policy drift out of date as you add tools.",
        ],
      },
      { type: "h2", text: "GDPR and CCPA in one policy" },
      {
        type: "p",
        text: "You don't need separate policies. Add a short GDPR section (legal bases + EU rights) and a CCPA/CPRA section (categories collected/shared, Do-Not-Sell/Share, GPC). If you sell through Shopify or a storefront as well, the [GDPR Compliance Checklist for Shopify Stores](/blog/gdpr-compliance-checklist-shopify-stores) covers the storefront-specific pieces.",
      },
      { type: "h2", text: "Generate one tailored to your stack" },
      {
        type: "p",
        text: "Instead of guessing, Comply-Quick generates a privacy policy from your actual tech stack and target jurisdictions — including the sub-processor list and legal bases — alongside a liability shield and a pre-launch checklist. Everything is informational and should be reviewed by counsel before you deploy it.",
      },
    ],
  },
];

export const BLOG_CATEGORIES = Array.from(new Set(BLOG_POSTS.map((p) => p.category)));
