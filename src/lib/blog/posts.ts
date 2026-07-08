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
  {
    slug: "webflow-gdpr-compliance-guide-agencies",
    title: "Is My Webflow Site GDPR Compliant? A Practical Guide for Agencies",
    description:
      "Webflow makes it easy to build beautiful sites — but GDPR compliance isn't automatic. This guide covers what Webflow handles, what it doesn't, and the exact steps agencies must take before handing a site over to an EU-facing client.",
    keywords: [
      "Webflow GDPR compliance",
      "Webflow privacy policy",
      "GDPR web agency",
      "Webflow cookie consent",
      "Webflow GDPR checklist",
    ],
    category: "GDPR",
    author: "Comply-Quick",
    publishedAt: "2026-07-08",
    updatedAt: "2026-07-08",
    related: [
      "gdpr-compliance-checklist-shopify-stores",
      "ada-compliance-for-web-developers",
      "gdpr-vs-ccpa-agencies-guide",
    ],
    body: [
      {
        type: "p",
        text: "Webflow is a favourite platform for design-led agencies — fast to build on, easy for clients to manage, and powerful enough for complex marketing sites. But when a client asks 'Is our Webflow site GDPR compliant?', the honest answer is: it depends on what you built on top of it.",
      },
      {
        type: "callout",
        text: "Webflow the platform is not liable for your client's GDPR compliance. Your agency is the data processor (or controller) for anything you configure, install, or embed.",
      },
      { type: "h2", text: "What Webflow handles out of the box" },
      {
        type: "ul",
        items: [
          "Webflow's own infrastructure is GDPR-compliant and offers a Data Processing Agreement (DPA) — accept it in your Webflow workspace settings.",
          "Webflow Hosting stores site assets in US data centres; EU site visitors' data transits to those servers.",
          "Webflow Forms store submissions in Webflow — this counts as personal data processing that must be disclosed in the site's privacy policy.",
        ],
      },
      { type: "h2", text: "What Webflow does NOT handle for you" },
      {
        type: "ul",
        items: [
          "Cookie consent management — Webflow does not block third-party scripts until a visitor consents. You must add a consent tool.",
          "Analytics and pixel blocking — Google Analytics, Meta Pixel, Hotjar, and similar scripts embedded via Webflow's custom code panel fire on page load by default.",
          "Privacy policy content — Webflow's template policies are generic. Your client needs a policy that names every processor, tracker, and legal basis.",
          "Developer-to-client liability — unless you have a written contract that transfers compliance responsibility, your agency may share liability for a non-compliant site.",
        ],
      },
      { type: "h2", text: "Step-by-step GDPR checklist for Webflow agency projects" },
      {
        type: "ol",
        items: [
          "Accept Webflow's DPA in workspace settings before launch.",
          "Audit every custom code embed and integration for trackers — use a headless scanner to catch what human review misses.",
          "Install a cookie consent manager (e.g. Cookiebot, CookieYes, or a custom implementation) that blocks non-essential scripts until opt-in consent is given.",
          "Ensure the consent banner offers a genuine 'Reject all' option — not just 'Accept' and 'Settings'.",
          "Generate a privacy policy that names Webflow, each analytics tool, each ad pixel, and any CRM or email platform the site uses.",
          "Add a Data Processing Agreement clause to your agency's client contract, transferring day-to-day compliance responsibility to the client once the site launches.",
          "Set up a GDPR contact point — a 'data@domain.com' address or a web form — for data subject requests.",
          "Log and store consent records so you can prove compliance during an audit.",
        ],
      },
      { type: "h2", text: "The tracker audit is the most important step" },
      {
        type: "p",
        text: "Agencies routinely under-count the trackers on a Webflow site because some are injected at runtime by other scripts or Webflow integrations — they don't appear in the Designer. A static code review won't find them. You need a runtime scan that renders the page in a real browser and records every outbound network call. See [Hidden JS Trackers Costing You CCPA Fines](/blog/hidden-js-trackers-ccpa-fines) for a breakdown of how this works.",
      },
      { type: "h2", text: "Protect your agency with a written liability waiver" },
      {
        type: "p",
        text: "Even if you follow every step above, your client may later add a Meta Pixel through Webflow's Editor without telling you. The safest outcome for your agency is a developer-to-client liability waiver in your contract — one that explicitly names the regulations covered, the tech stack at handoff, and a clause transferring ongoing compliance responsibility to the client. Comply-Quick generates this waiver automatically from your site's actual stack and jurisdiction. Run a [free scan](/dashboard?utm_source=blog&utm_medium=cta&utm_campaign=webflow-gdpr) to see what you're working with.",
      },
    ],
  },
  {
    slug: "shopify-ccpa-compliance-checklist-agencies",
    title: "Shopify CCPA Compliance Checklist for Agencies",
    description:
      "California's CCPA/CPRA affects every Shopify store that sells to California residents. This checklist walks agencies through the exact steps — opt-out links, GPC, tracker disclosure — to protect their clients and themselves.",
    keywords: [
      "Shopify CCPA compliance",
      "CCPA agency checklist",
      "Do Not Sell Shopify",
      "CPRA Shopify",
      "California privacy law ecommerce",
    ],
    category: "CCPA",
    author: "Comply-Quick",
    publishedAt: "2026-07-08",
    updatedAt: "2026-07-08",
    related: [
      "hidden-js-trackers-ccpa-fines",
      "gdpr-compliance-checklist-shopify-stores",
      "gdpr-vs-ccpa-agencies-guide",
    ],
    body: [
      {
        type: "p",
        text: "The California Consumer Privacy Act (CCPA), strengthened by the CPRA, applies to any Shopify store that collects personal data from California residents — and Shopify stores almost always do. If you're an agency building or maintaining Shopify stores, your clients are relying on you to get this right. Here's what the law actually requires and how to implement it.",
      },
      { type: "h2", text: "Does CCPA apply to your client's store?" },
      {
        type: "p",
        text: "The CCPA/CPRA applies to for-profit businesses that meet any one of these thresholds: annual gross revenue over $25M; buy, sell, or share personal information of 100,000+ consumers/households; or derive 50%+ of revenue from selling personal information. Most mid-size Shopify stores will cross the 100,000 consumer threshold faster than they think — one pixel firing on 300 visitors a day across a year is enough.",
      },
      {
        type: "callout",
        text: "Even if your client is below every threshold today, building CCPA-compliant infrastructure now costs almost nothing. Building it after an enforcement notice costs significantly more.",
      },
      { type: "h2", text: "The CCPA/CPRA Shopify agency checklist" },
      {
        type: "ol",
        items: [
          "Audit all trackers: identify every third-party script that loads on storefront pages — especially Meta Pixel, Google Ads, TikTok Pixel, Pinterest, and any affiliate or session-replay tools. Each one is a potential 'sale or share' under CCPA.",
          "Add a 'Do Not Sell or Share My Personal Information' link to the homepage footer — this is a legal requirement once your store sells or shares data.",
          "Honor the Global Privacy Control (GPC) signal automatically — browsers and extensions send GPC to indicate a user's opt-out preference, and Shopify stores must respect it.",
          "Update the privacy policy to disclose: categories of personal data collected, categories of third parties data is shared with, and the consumer's rights under CCPA.",
          "Implement a consumer rights mechanism: give customers a way to request access to their data, request deletion, and opt out of sale/sharing. Shopify's built-in customer data request feature covers deletion, but you need a form or link for access and opt-out requests.",
          "Sign a Service Provider Agreement (SVA) with Shopify — available in Shopify's DPA settings. Without it, Shopify may not qualify as a 'service provider' under CCPA, meaning data shared with them counts as a sale.",
          "Audit your email marketing apps (Klaviyo, Mailchimp, etc.) — each one needs a Service Provider Agreement. Many have this in their settings or privacy pages.",
          "Set a 15-day response window for consumer rights requests (the CCPA/CPRA deadline).",
        ],
      },
      { type: "h2", text: "The tracker problem: why you can't do this manually" },
      {
        type: "p",
        text: "The most common CCPA failure for Shopify stores is undisclosed trackers — scripts that load at runtime through Shopify apps or tag managers that the agency never directly installed. A manual code review of the theme won't find them. Read [Hidden JS Trackers Costing You CCPA Fines](/blog/hidden-js-trackers-ccpa-fines) to understand what a runtime audit catches, or run an automated scan on the storefront directly.",
      },
      { type: "h2", text: "Protect your agency's liability exposure" },
      {
        type: "p",
        text: "Agencies that build Shopify stores are often implicated when a client faces enforcement, especially if the agency installed the trackers that caused the issue. A written liability waiver — scoped to the specific regulations and tech stack present at handoff — is the cleanest protection. Comply-Quick generates this alongside a CCPA-mapped privacy policy and a pre-launch checklist. [Run a free scan](/dashboard?utm_source=blog&utm_medium=cta&utm_campaign=shopify-ccpa) to see your client's exposure before launch.",
      },
    ],
  },
  {
    slug: "ada-compliance-for-web-developers",
    title: "ADA Compliance for Web Developers: What You're Actually Liable For",
    description:
      "ADA website compliance lawsuits are rising fast — and developers are increasingly named alongside their clients. Here's what the law covers, what WCAG 2.1 AA requires, and how to protect yourself.",
    keywords: [
      "ADA website compliance",
      "WCAG 2.1 AA developers",
      "ADA compliance liability",
      "web accessibility law",
      "ADA lawsuit website",
    ],
    category: "ADA",
    author: "Comply-Quick",
    publishedAt: "2026-07-08",
    updatedAt: "2026-07-08",
    related: [
      "webflow-gdpr-compliance-guide-agencies",
      "gdpr-vs-ccpa-agencies-guide",
      "privacy-policy-template-saas-founders",
    ],
    body: [
      {
        type: "p",
        text: "ADA website lawsuits have been rising sharply since 2017, and they're not just targeting large corporations. Small businesses, nonprofits, and their web developers are receiving demand letters — often with a settlement figure attached. If you build websites for clients without addressing accessibility, you may share the liability.",
      },
      { type: "h2", text: "Does the ADA apply to websites?" },
      {
        type: "p",
        text: "The Americans with Disabilities Act (Title III) prohibits discrimination against people with disabilities in places of public accommodation. Courts have increasingly ruled that websites qualify as places of public accommodation — especially when connected to a physical business. The Department of Justice issued guidance in 2022 confirming this position, and WCAG 2.1 Level AA is the de facto standard the DOJ references.",
      },
      {
        type: "callout",
        text: "Serial ADA litigants file hundreds of demand letters per year. Their process is automated: scan sites for accessibility violations, send demand letters to site owners and sometimes their developers, then settle for $5,000–$25,000.",
      },
      { type: "h2", text: "What WCAG 2.1 AA requires" },
      {
        type: "p",
        text: "WCAG 2.1 Level AA is organized around four principles — Perceivable, Operable, Understandable, Robust. The failures most commonly cited in lawsuits are:",
      },
      {
        type: "ul",
        items: [
          "Images without alt text — screen readers cannot describe them.",
          "Form fields without labels — users with screen readers cannot identify what to enter.",
          "Insufficient color contrast — text must meet a 4.5:1 contrast ratio against its background.",
          "No keyboard navigation — interactive elements must be reachable and operable without a mouse.",
          "Videos without captions — all prerecorded video with audio must have closed captions.",
          "Inaccessible PDFs — if you link to or embed PDFs, they must be tagged for accessibility.",
        ],
      },
      { type: "h2", text: "Where developer liability actually comes from" },
      {
        type: "p",
        text: "When a client receives a demand letter for an inaccessible website, they may turn to the developer who built it — especially if no accessibility scope was discussed and no waiver was signed. Developer liability typically arises from: (1) building a site with obvious violations, (2) not disclosing accessibility as out-of-scope in the contract, or (3) being explicitly contracted to deliver a 'compliant' site without defining what that means.",
      },
      {
        type: "p",
        text: "The safest outcome is a contract that clearly defines what accessibility work is and isn't included, paired with a liability waiver that transfers ongoing maintenance responsibility to the client after handoff.",
      },
      { type: "h2", text: "The practical checklist for agency projects" },
      {
        type: "ol",
        items: [
          "Run an automated scan (axe DevTools, WAVE, or Comply-Quick's ADA scan) on every page before launch — catch the obvious violations.",
          "Verify all images have meaningful alt text (or empty alt='' for decorative images).",
          "Check all form fields have visible, programmatic labels.",
          "Verify color contrast for all text using a contrast checker — 4.5:1 for normal text, 3:1 for large text.",
          "Test keyboard navigation: Tab through every interactive element. Can you reach and activate all links, buttons, and form fields?",
          "Add captions to any embedded videos.",
          "Include an accessibility statement on the site noting the standard targeted and a contact for accessibility issues.",
          "Add an ADA scope clause to your client contract — specify what was addressed, reference WCAG 2.1 AA, and transfer ongoing compliance responsibility after launch.",
        ],
      },
      { type: "h2", text: "Automated scans catch about 30–40% of issues" },
      {
        type: "p",
        text: "Automated tools are a critical first pass, but they can't catch everything — keyboard trap testing, logical reading order, and cognitive load issues require manual review. For client projects where ADA risk is material (e.g. healthcare, retail, government-adjacent), a manual audit by an accessibility specialist is worth the investment. For most agency projects, a documented automated scan + the contract protection above is a reasonable baseline.",
      },
      { type: "h2", text: "Protect your agency" },
      {
        type: "p",
        text: "Comply-Quick's scanner flags ADA/WCAG violations alongside GDPR and CCPA risks and generates a developer liability waiver that explicitly covers accessibility obligations. [Run a free scan](/dashboard?utm_source=blog&utm_medium=cta&utm_campaign=ada-dev) to see what a client's site exposes you to before you hand over the keys.",
      },
    ],
  },
  {
    slug: "gdpr-vs-ccpa-agencies-guide",
    title: "GDPR vs CCPA: What US Agencies Building for EU Clients Must Know",
    description:
      "GDPR and CCPA are often confused — but they have different triggers, different obligations, and different consequences. This guide breaks down what US web agencies actually need to understand when building for EU-facing clients.",
    keywords: [
      "GDPR vs CCPA",
      "US agency GDPR",
      "CCPA GDPR differences",
      "web agency privacy law",
      "GDPR for US companies",
    ],
    category: "Privacy",
    author: "Comply-Quick",
    publishedAt: "2026-07-08",
    updatedAt: "2026-07-08",
    related: [
      "gdpr-compliance-checklist-shopify-stores",
      "hidden-js-trackers-ccpa-fines",
      "webflow-gdpr-compliance-guide-agencies",
    ],
    body: [
      {
        type: "p",
        text: "US agencies frequently ask: 'Our client is a US company — do we really need to worry about GDPR?' The answer, almost always, is yes. If the site is accessible to EU visitors (even passively), the GDPR may apply. Here's how to think about the two laws side by side.",
      },
      { type: "h2", text: "The core difference: how each law is triggered" },
      {
        type: "ul",
        items: [
          "GDPR: triggered by the location of the data subject (the visitor), not the business. If an EU resident visits and their data is processed, GDPR applies — regardless of where your client's company is based.",
          "CCPA/CPRA: triggered by the location of the consumer (California residents) and the size/revenue thresholds of the business collecting data.",
        ],
      },
      {
        type: "callout",
        text: "A US business with no EU office, no EU sales, and no EU marketing can still be subject to GDPR if their website is accessible to EU residents and collects their data — which almost every site with analytics does.",
      },
      { type: "h2", text: "Key legal differences that affect how you build" },
      {
        type: "ul",
        items: [
          "Consent standard: GDPR requires explicit, granular, opt-in consent for non-essential cookies and tracking. CCPA requires an opt-out mechanism (not opt-in) for data sales/sharing.",
          "Cookie banners: under GDPR, you must block tracking scripts until consent is given. Under CCPA, trackers may load but users must be able to opt out. The GDPR standard is stricter.",
          "Privacy policy requirements: GDPR requires named legal bases for processing and explicit processor lists. CCPA requires disclosure of categories of data shared and the categories of recipients.",
          "Data subject rights: GDPR gives broad rights (access, erasure, portability, objection, restriction). CCPA gives rights to access, deletion, correction, and opt-out of sale/sharing.",
          "Enforcement: GDPR fines can reach 4% of global annual turnover. CCPA fines are $2,500–$7,500 per intentional violation. GDPR has more teeth, but CCPA enforcement is growing.",
        ],
      },
      { type: "h2", text: "Do you need two separate policies?" },
      {
        type: "p",
        text: "No — you can satisfy both laws in a single privacy policy. The standard approach is one unified policy with dedicated GDPR and CCPA sections. The GDPR section covers legal bases, EU representative (if applicable), and EU data subject rights. The CCPA section covers the categories of data sold/shared and the Do-Not-Sell/Share mechanism. See [Privacy Policy Template for SaaS Founders](/blog/privacy-policy-template-saas-founders) for a structure that works for both.",
      },
      { type: "h2", text: "What US agencies building EU-facing sites must do differently" },
      {
        type: "ol",
        items: [
          "Default to GDPR consent standards for cookie banners — block tracking until opt-in. This also satisfies most state-level US privacy laws as a side effect.",
          "Choose analytics tools with EU data residency options or EU-US Data Privacy Framework compliance (Google Analytics 4, Fathom, Plausible).",
          "Include a GDPR section in the privacy policy with named legal bases for each data processing activity.",
          "Sign a Data Processing Agreement with each tool that processes EU personal data.",
          "Add a developer-to-client contract clause specifying jurisdiction scope and transferring the client's ongoing GDPR compliance responsibility after handoff.",
        ],
      },
      { type: "h2", text: "The practical approach for agency projects" },
      {
        type: "p",
        text: "Most US agencies building for clients with any EU traffic exposure should default to GDPR-level practices — it's the stricter standard and satisfies both laws. Build consent-first, write one combined policy, sign DPAs with every tool, and protect yourself with a stack-specific liability waiver. Comply-Quick maps all of this to your exact tech stack and generates the documents in one pass. [Run a free scan](/dashboard?utm_source=blog&utm_medium=cta&utm_campaign=gdpr-ccpa-guide) to see where your client's site stands across both frameworks.",
      },
      {
        type: "p",
        text: "For Webflow-specific GDPR guidance, see [Is My Webflow Site GDPR Compliant?](/blog/webflow-gdpr-compliance-guide-agencies). For Shopify CCPA specifics, see [Shopify CCPA Compliance Checklist for Agencies](/blog/shopify-ccpa-compliance-checklist-agencies).",
      },
    ],
  },
];

export const BLOG_CATEGORIES = Array.from(new Set(BLOG_POSTS.map((p) => p.category)));
