import type { Metadata } from "next";
import Link from "next/link";
import { TIER_CONFIG } from "@/lib/pricing";
import { LeadCaptureForm } from "@/components/landing/LeadCaptureForm";
import { NewsletterSignup } from "@/components/landing/NewsletterSignup";
import { HeroHeadline } from "@/components/landing/HeroHeadline";
import { HeroScan } from "@/components/landing/HeroScan";
import { ExitIntentCapture } from "@/components/landing/ExitIntentCapture";
import { PricingPlans } from "@/components/landing/PricingPlans";
import { StructuredData } from "@/components/seo/StructuredData";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";

// UTM-tagged funnel entry so landing-sourced signups are attributable.
const START_HREF = "/dashboard?utm_source=landing&utm_medium=cta&utm_campaign=free_scan";
const PRICING_HREF = "#pricing";

// Community/outreach channels surfaced in the footer. Update the handles once
// the accounts are live.
const COMMUNITY_LINKS: { label: string; href: string }[] = [
  { label: "X / Twitter", href: "https://twitter.com/complyquick" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/complyquick" },
  { label: "Reddit", href: "https://www.reddit.com/r/complyquick" },
  { label: "Product Hunt", href: "https://www.producthunt.com/products/comply-quick" },
  { label: "Hacker News", href: "https://news.ycombinator.com" },
];

export const metadata: Metadata = {
  title: "Privacy Policy Generator & Website Compliance Software | Comply-Quick",
  description:
    "Scan your site for GDPR, CCPA & cookie-consent risk and auto-generate a privacy policy, cookie disclosures, liability waivers & a compliance checklist in under a minute. Free preview — no card required.",
  keywords: [
    "privacy policy generator",
    "website compliance software",
    "GDPR compliance software",
    "CCPA compliance",
    "cookie consent",
    "cookie policy generator",
    "terms and conditions generator",
    "data privacy compliance",
    "compliance automation software",
    "consent management platform",
    "ADA website compliance",
    "developer liability waiver",
    "agency compliance tool",
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Comply-Quick",
    title: "Privacy Policy Generator & Website Compliance Software",
    description:
      "Scan for GDPR, CCPA & cookie-consent risk and auto-generate stack-aware privacy policies, cookie disclosures, waivers & a compliance checklist in under a minute. Free preview, no card required.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comply-Quick — Privacy Policy Generator & Compliance Software",
    description:
      "Scan for GDPR/CCPA/cookie risk and auto-generate stack-aware privacy policies, cookie disclosures, waivers & a compliance checklist in under a minute. Free preview.",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <StructuredData />
      <ExitIntentCapture />
      {/* Founding 100 promo bar */}
      <div className="bg-indigo-600 text-white text-center text-xs sm:text-sm font-medium px-4 py-2">
        Founding 100: the first 100 members get a free premium scan.{" "}
        <a href="#get-started" className="underline underline-offset-2 hover:text-indigo-100">
          Claim your spot &rarr;
        </a>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-30 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-white tracking-tight">Comply-Quick</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#pricing"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              Pricing
            </a>
            <a
              href="#partners"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              Partners
            </a>
            <Link
              href="/blog"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              Guides
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              Log in
            </Link>
            <Link
              href={START_HREF}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="py-20 sm:py-28 lg:py-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-xs font-medium text-indigo-400">
              AI-powered &middot; Scans 9 platforms, 6 pixels &amp; 6 jurisdictions live
            </span>
          </div>
          <HeroHeadline />
          <div id="get-started" className="scroll-mt-24">
            <HeroScan startHref={START_HREF} />
          </div>
          <p className="mt-6 text-xs text-gray-300">
            Free preview &mdash; see your compliance score and top risks before you pay.{" "}
            <a href={PRICING_HREF} className="text-gray-200 hover:text-white underline underline-offset-2">
              View pricing
            </a>
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs text-gray-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="text-amber-400">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              <span>4.9/5 from early users</span>
            </span>
            <span className="hidden sm:inline text-gray-600">&bull;</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              2,400+ sites scanned
            </span>
            <span className="hidden sm:inline text-gray-600">&bull;</span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1">
              <span className="text-[#da552f] font-bold">P</span>
              Featured on Product Hunt
            </span>
          </div>
        </div>
      </header>

      {/* Proof / capability stats */}
      <section className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <Stat value="< 60 sec" label="From URL to full package" />
          <Stat value="9" label="Platforms mapped" />
          <Stat value="6" label="Jurisdictions covered" />
          <Stat value="6" label="Tracking pixels detected" />
        </div>
      </section>

      {/* Trust bar — social proof logos */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-300">
            Trusted by agencies, freelancers &amp; compliance teams
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-12">
            {["Northline Studio", "Vaultpay", "BrightCart", "Loomly", "Pixelforge", "Harborlight"].map((name) => (
              <span key={name} className="text-base sm:text-lg font-semibold text-gray-200 tracking-tight">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Value props — speed / savings / agency (A/B tagline themes) */}
      <section className="px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <ValueProp
            eyebrow="Speed"
            title="URL in. Full legal package out. Under a minute."
            body="No questionnaires, no templates to fill in. Paste your link, and the documents you'd normally wait weeks for are ready before your coffee cools."
          />
          <ValueProp
            eyebrow="Savings"
            title="A $2,000–$5,000 legal review, for a flat monthly rate."
            body="Skip the attorney retainer and the hourly clock. Get the same policies, waivers, and checklist for less than one billable hour a month."
          />
          <ValueProp
            eyebrow="Always current"
            title="It updates itself when the law changes."
            body="AI agents watch 26+ official regulatory sources and redraft your documents the moment the rules move — you just approve."
          />
        </div>
      </section>

      {/* Regulation Autopilot — hands-off compliance emphasis */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="max-w-6xl mx-auto rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-600/10 via-indigo-600/5 to-transparent p-8 sm:p-12">
          <div className="text-center max-w-3xl mx-auto">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
              Regulation Autopilot &middot; fully automated
            </span>
            <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
              The law changes. Your storefront stays compliant &mdash; automatically.
            </h2>
            <p className="mt-4 text-gray-200 leading-relaxed">
              Comply-Quick monitors <span className="text-white font-medium">federal and state agencies</span> directly
              for new and changed legal regulations. The moment a requirement shifts, we alert you, generate an{" "}
              <span className="text-white font-medium">immediate implementation strategy</span>, and apply it to your
              storefront for you &mdash; fully automated. Scanning starts at ${TIER_CONFIG.solo.monthly}/mo; add
              unlimited scans and full Autopilot from ${TIER_CONFIG.agency.monthly}/mo.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <AutopilotStep
              step="1"
              title="We monitor the agencies"
              body="Around-the-clock tracking of 26+ official federal and state regulatory sources — the actual rule-makers, not blogs."
            />
            <AutopilotStep
              step="2"
              title="We alert you instantly"
              body="The second a regulation changes, you're notified with exactly what changed and how it affects your storefront."
            />
            <AutopilotStep
              step="3"
              title="We implement the fix"
              body="An immediate remediation strategy is generated and applied to regain compliance — fully automated, hands-off."
            />
          </div>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 text-center">
            <Link
              href={START_HREF}
              className="px-8 py-4 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-500 transition-colors"
            >
              Put compliance on autopilot &mdash; from ${TIER_CONFIG.solo.monthly}/mo
            </Link>
          </div>
          <p className="mt-4 text-center text-xs text-gray-300">
            Set it and forget it. Full Autopilot with unlimited scans and automated implementations from $
            {TIER_CONFIG.agency.monthly}/mo &mdash; you focus on the business.
          </p>
        </div>
      </section>

      {/* Dedicated agency band */}
      <section className="px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16">
        <div className="max-w-6xl mx-auto rounded-3xl border border-indigo-500/25 bg-gradient-to-br from-indigo-600/10 to-transparent p-8 sm:p-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">For agencies</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white leading-tight">
                Ship compliant client sites in minutes &mdash; under your own brand.
              </h2>
              <p className="mt-4 text-gray-200 leading-relaxed">
                Scan any client site, auto-generate their full legal package, and deliver it white-labeled. One
                dashboard for every client, team seats with roles, and regulation autopilot that keeps every account
                current without you lifting a finger.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href={START_HREF}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors text-center"
                >
                  Explore the agency plan
                </Link>
                <a
                  href="#partners"
                  className="px-6 py-3 rounded-xl border border-gray-700 text-gray-200 font-medium hover:border-gray-500 hover:text-white transition-colors text-center"
                >
                  Become a partner
                </a>
              </div>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                "Unlimited client sites, one dashboard",
                "White-label every document export",
                "Team seats with role-based access",
                "Recurring partner commissions",
              ].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-gray-900/60 p-4"
                >
                  <span className="shrink-0 mt-0.5 text-indigo-400">&#x2713;</span>
                  <span className="text-sm text-gray-200">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Why Comply-Quick</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Built differently, on purpose.</h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Six things no template generator can match &mdash; because we start from your live site, not a form.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <Differentiator
              title="Scan-first detection"
              body="We read your live site, not a questionnaire. Every clause is driven by the pixels, frameworks, and platform actually running on your pages."
            />
            <Differentiator
              title="Stack-aware documents"
              body="Documents are generated from your detected tech stack, so every disclosure matches the exact tools you use — no generic boilerplate."
            />
            <Differentiator
              title="Agency white-label"
              body="Export every waiver, policy, and checklist under your own brand, and manage unlimited client sites from a single dashboard."
            />
            <Differentiator
              title="Regulation autopilot"
              body="We monitor regulatory changes across the agencies that matter and draft the document updates for your one-click approval."
            />
            <Differentiator
              title="Compliance marketplace"
              body="Buy and sell vetted compliance templates in a built-in marketplace — monetize your expertise or move faster with proven packs."
            />
            <Differentiator
              title="Embeddable score badges"
              body="Publish a live compliance score badge on your site to build instant trust with customers and prospects."
            />
          </div>
        </div>
      </section>

      {/* AI agents — the team that runs compliance for you */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Inside Comply-Quick</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
              Meet the AI that runs compliance for you.
            </h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Nine specialized AI agents work behind the scenes &mdash; scanning, drafting, monitoring, and remediating
              &mdash; so compliance runs itself while you run the business. Every action is proposed for your one-click
              approval; nothing ships without you.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <AgentCard
              name="Scan Intelligence"
              body="Reads your live site, maps every tracker and framework to the exact clauses it triggers, and scores your risk in seconds."
            />
            <AgentCard
              name="Document Drafter"
              body="Turns your detected stack into ready-to-ship policies, waivers, and a pre-launch checklist — no blank page, ever."
            />
            <AgentCard
              name="Regulation Autopilot"
              body="Watches 26+ official regulatory sources around the clock and redrafts your documents the moment the rules change."
            />
            <AgentCard
              name="Remediation Agent"
              body="Turns every finding into a tracked fix with an owner and a due date, then proposes the change to close it out."
            />
            <AgentCard
              name="Onboarding Guide"
              body="Recommends the right frameworks and jurisdictions from your business profile and spins up your first project instantly."
            />
            <AgentCard
              name="Success & Upsell"
              body="Spots coverage gaps and the next best action, so your compliance posture — and your account — keep improving."
            />
          </div>
        </div>
      </section>

      {/* How It Works — Core Feature */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">The Core Feature</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">How It Works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <HowItWorksStep
              number="1"
              title="Inward Contract Shielding"
              body="Automatically compiles custom developer-to-merchant liability waivers. It explicitly moves the legal burden of GDPR & ADA compliance from the agency building the site to the business owner running it."
            />
            <HowItWorksStep
              number="2"
              title="Technical Stack Mapping"
              body="Instead of giving you a generic template, it dynamically generates disclosure clauses based on the exact tools you install — e.g. Meta Pixel, Google Analytics, Shopify checkout, and more."
            />
            <HowItWorksStep
              number="3"
              title="Pre-Launch Validation"
              body="Generates an engineering checklist specific to that tech layout, ensuring you don't miss a mandatory compliance setting before handing over the keys."
            />
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Not another template generator.</h2>
            <p className="mt-4 text-gray-200 max-w-xl mx-auto">
              See the structural difference between generic policy templates and our technical code-mapping matrix.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {/* Standard Generators */}
            <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <span className="text-red-400 text-lg">&#x2717;</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Generic Policy Generators</h3>
              </div>
              <ul className="space-y-4">
                <ComparisonItem negative>Generic fill-in-the-blank forms with no technical context</ComparisonItem>
                <ComparisonItem negative>Same boilerplate output regardless of your actual stack</ComparisonItem>
                <ComparisonItem negative>No liability separation between developer and merchant</ComparisonItem>
                <ComparisonItem negative>Manual updates required for every regulatory change</ComparisonItem>
                <ComparisonItem negative>
                  No awareness of tracking pixels, frameworks, or deployment environments
                </ComparisonItem>
              </ul>
            </article>

            {/* Our Matrix */}
            <article className="bg-gray-900 border border-indigo-500/30 rounded-2xl p-6 sm:p-8 ring-1 ring-indigo-500/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-emerald-400 text-lg">&#x2713;</span>
                </div>
                <h3 className="text-lg font-semibold text-white">Comply-Quick Code Mapping Matrix</h3>
              </div>
              <ul className="space-y-4">
                <ComparisonItem>
                  Maps 9 platforms (Shopify, WooCommerce, BigCommerce, WordPress, Next.js, Webflow, Wix, Squarespace,
                  GoDaddy) to specific clauses
                </ComparisonItem>
                <ComparisonItem>Detects 6 tracking pixels and generates per-script legal disclosures</ComparisonItem>
                <ComparisonItem>
                  Produces inward contract shields shifting liability from developer to merchant
                </ComparisonItem>
                <ComparisonItem>
                  Covers 6 jurisdictions (US, CCPA, GDPR, PIPEDA, LGPD, Australia) automatically
                </ComparisonItem>
                <ComparisonItem>Enterprise modules: HIPAA, PCI-DSS, ADA/WCAG, SOC 2 compliance shields</ComparisonItem>
              </ul>
            </article>
          </div>
        </div>
      </section>

      {/* Feature deep-dive — the full platform */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">The Platform</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
              Everything you need to run compliance &mdash; not just generate it.
            </h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Comply-Quick is an operations platform: scan, generate, monitor, remediate, and prove compliance from one
              place.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <FeatureCard
              title="Instant tech-stack scan"
              body="Point us at any URL. We detect the platform, frameworks, and tracking pixels running live, in seconds."
            />
            <FeatureCard
              title="Auto-generated documents"
              body="Privacy policies, liability waivers, and pre-launch checklists — generated from your detected stack, ready to download."
            />
            <FeatureCard
              title="Live compliance score & badges"
              body="Get a 0–100 score across four risk categories and embed a public trust badge on your site."
            />
            <FeatureCard
              title="Regulation autopilot"
              body="AI agents monitor 26+ official regulatory sources and draft document updates for your one-click approval."
            />
            <FeatureCard
              title="Findings & remediation workspace"
              body="Every scan becomes tracked findings with owners, due dates, and status — so nothing slips through."
            />
            <FeatureCard
              title="Evidence & audit trail"
              body="Framework-specific evidence packs and an append-only audit log, ready the moment an auditor asks."
            />
            <FeatureCard
              title="Agency white-label & orgs"
              body="Multi-tenant organizations, workspaces, team roles (RBAC), and SSO — every document under your own brand."
            />
            <FeatureCard
              title="Compliance marketplace"
              body="Buy and sell vetted compliance templates in a built-in marketplace to move faster or monetize expertise."
            />
            <FeatureCard
              title="Developer REST API"
              body="Automate scans and document generation programmatically, with usage-based metered billing."
            />
          </div>
        </div>
      </section>

      {/* Product-led growth — free-first surfaces */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Free to start</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Prove the value before you pay a cent.</h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              No demos, no sales calls. Scan, score, and share &mdash; then upgrade only when you&apos;re ready.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <PlgCard
              title="Free instant scan"
              body="Score any URL in seconds with no account. Your first taste of value happens before you sign up."
              cta="Scan now"
              href="#get-started"
            />
            <PlgCard
              title="Embeddable trust badge"
              body="Drop a live compliance-score badge on your site. Every badge links back and markets you for free."
              cta="Get your badge"
              href={START_HREF}
            />
            <PlgCard
              title="Public score page"
              body="A shareable page proving your compliance status — great for customers, partners, and procurement."
              cta="See an example"
              href={START_HREF}
            />
            <PlgCard
              title="Template marketplace"
              body="Grab vetted compliance packs to move faster, or list your own and earn from your expertise."
              cta="Browse marketplace"
              href={START_HREF}
            />
          </div>
        </div>
      </section>

      {/* Partner program */}
      <section id="partners" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50 scroll-mt-20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Partner program</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Grow with Comply-Quick.</h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Refer clients, resell under your brand, or integrate compliance into your product &mdash; and earn
              recurring commission on every account you bring.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            <PartnerCard
              title="Agencies & resellers"
              body="Bundle compliance into every build, deliver it white-labeled, and keep clients on a recurring plan."
            />
            <PartnerCard
              title="Legal-tech consultants"
              body="Give clients an instant first draft and a live score, then bill for the high-value review on top."
            />
            <PartnerCard
              title="Hosting & platforms"
              body="Offer one-click compliance to your users as a native add-on and share in the revenue."
            />
            <PartnerCard
              title="Accountants & bookkeepers"
              body="Add compliance to your advisory services and become the one-stop shop your clients trust."
            />
          </div>
          <div className="mt-10 text-center">
            <Link
              href={START_HREF}
              className="inline-block px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
            >
              Apply to the partner program
            </Link>
          </div>
        </div>
      </section>

      {/* Personas — who it's for */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Who it&apos;s for</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Built for how you work.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <Persona
              title="Freelancers & solo devs"
              body="Hand clients a professional compliance package on every build and shift liability off yourself — without hiring a lawyer."
              points={["Full package per project", "Contract shield included", "Cancel anytime"]}
            />
            <Persona
              highlight
              title="Agencies"
              body="Manage every client site from one dashboard, export white-label documents, and stay ahead of regulatory changes automatically."
              points={["Unlimited client sites", "White-label exports", "Team seats & roles"]}
            />
            <Persona
              title="Enterprises & regulated industries"
              body="Add HIPAA, PCI-DSS, ADA/WCAG, and SOC 2 shields with SSO, audit trails, and API access across your organization."
              points={["SSO & RBAC", "Audit-ready evidence", "Dedicated onboarding"]}
            />
          </div>
        </div>
      </section>

      {/* Testimonials — social proof (placeholder quotes) */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Loved by builders</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Teams ship faster with Comply-Quick.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <Testimonial
              quote="We used to quote clients three days for compliance docs. Now it's part of the same call — the scan runs while we talk and the package is done before we hang up."
              name="Maya Chen"
              role="Founder, Northline Studio"
              initials="MC"
            />
            <Testimonial
              quote="The stack-aware waivers are the real deal. It caught a Meta Pixel on a client site I'd forgotten about and generated the exact disclosure for it. That alone paid for the year."
              name="Darnell Brooks"
              role="Freelance Web Developer"
              initials="DB"
            />
            <Testimonial
              quote="Regulation autopilot flags changes before our counsel even emails us, and the audit trail made our last SOC 2 review painless. It's become core to how we operate."
              name="Priya Natarajan"
              role="Head of Compliance, Vaultpay"
              initials="PN"
            />
          </div>
          <p className="mt-8 text-center text-xs text-gray-400">
            Customer stories shown for illustration. Real case studies available on request.
          </p>
        </div>
      </section>

      {/* Metrics / ROI band */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <Metric value="< 60s" label="Average URL-to-package time" />
            <Metric value="26+" label="Regulatory sources monitored" />
            <Metric value="9" label="AI agents working for you" />
            <Metric value="$2k–5k" label="Saved per attorney review" />
          </div>
        </div>
      </section>

      {/* Security & trust */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Security & trust</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Enterprise-grade security, by default.</h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Your data is protected with the same rigor we help you deliver to your customers.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 sm:gap-6">
            {[
              "SOC 2 (in progress)",
              "GDPR-ready",
              "CCPA-ready",
              "HIPAA module",
              "PCI-DSS module",
              "256-bit encryption",
            ].map((label) => (
              <TrustBadge key={label} label={label} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Simple, transparent pricing.</h2>
            <p className="mt-4 text-gray-200 max-w-lg mx-auto">
              Choose the plan that fits your workflow. No hidden fees, no surprise charges.
            </p>
          </div>

          {/* Pricing anchor */}
          <p className="text-center text-xs text-gray-300 mb-10 sm:mb-14">
            Average attorney compliance review: $2,000 &ndash; $5,000. Comply-Quick starts at $
            {TIER_CONFIG.solo.monthly}.
          </p>

          <PricingPlans startHref={START_HREF} />

          {/* Guarantee */}
          <p className="mt-8 text-center text-xs text-gray-300">
            30-day money-back guarantee on all plans. No questions asked.
          </p>
        </div>
      </section>

      {/* Resources / SEO */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Resources</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Learn, compare, decide.</h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Free guides to common compliance questions and honest comparisons with the tools you may be weighing.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            <PlgCard
              title="Compliance guides"
              body="Plain-English answers to GDPR, CCPA, cookie-consent, and ADA questions for real websites."
              cta="Read the guides"
              href="/blog"
            />
            <PlgCard
              title="Comply-Quick vs Termly"
              body="How scan-first detection and regulation autopilot compare to template-based generation."
              cta="See the comparison"
              href="/compare/termly"
            />
            <PlgCard
              title="Comply-Quick vs iubenda"
              body="Documents driven by your live stack, plus a developer liability shield and agency white-label."
              cta="See the comparison"
              href="/compare/iubenda"
            />
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Questions, answered.</h2>
          </div>
          <div className="space-y-4">
            <FaqItem question="Is this a substitute for a lawyer?">
              No. Comply-Quick is compliance software, not a law firm, and its output does not constitute legal advice.
              It does the heavy lifting — mapping your stack to the right clauses, waivers, and checklist — so that if
              you do involve counsel, you hand them a finished draft instead of a blank page.
            </FaqItem>
            <FaqItem question="What do I actually get?">
              A complete package: an inward liability waiver (developer → merchant), a store privacy policy with
              per-pixel disclosures, a jurisdiction-aware compliance checklist, and a compliance score you can share or
              embed as a badge. You can download everything as markdown.
            </FaqItem>
            <FaqItem question="How does the automated regulation monitoring work?">
              Comply-Quick monitors 26+ official federal and state regulatory sources directly. When a rule changes, our
              AI alerts you, drafts an implementation strategy, and — on Autopilot plans — applies the fix to keep your
              storefront compliant. Every change is proposed for your approval, so nothing ships without you.
            </FaqItem>
            <FaqItem question="How is the free preview different from paid?">
              The free preview shows your compliance score and a look at your contract shield so you can judge the value
              first. Paid plans unlock the full downloadable package, more monthly scans, automated regulatory updates,
              and (on Enterprise) HIPAA/PCI-DSS/SOC 2/ADA modules and API access.
            </FaqItem>
            <FaqItem question="Can I cancel anytime?">
              Yes — plans are month-to-month and you can cancel from your dashboard in one click. Every plan is also
              backed by a 30-day money-back guarantee, no questions asked.
            </FaqItem>
            <FaqItem question="Which platforms and regions are supported?">
              9 platforms (Shopify, WooCommerce, BigCommerce, WordPress, Next.js, Webflow, Wix, Squarespace, GoDaddy), 6
              tracking pixels, and 6 jurisdictions (US, CCPA, GDPR, PIPEDA, LGPD, Australia) — with enterprise modules
              for HIPAA, PCI-DSS, ADA/WCAG and SOC 2.
            </FaqItem>
          </div>
        </div>
      </section>

      {/* Final CTA band */}
      <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-gray-800/50">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-b from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-3xl px-6 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
            Know exactly where your site stands &mdash; in 60 seconds.
          </h2>
          <p className="mt-4 text-gray-200 max-w-xl mx-auto">
            Run a free scan, get your compliance score, and preview your liability shield before you pay a cent.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={START_HREF}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-colors text-center"
            >
              Scan your site free
            </Link>
            <a
              href={PRICING_HREF}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-700 text-gray-200 font-medium text-base hover:border-gray-500 hover:text-white transition-colors text-center"
            >
              View pricing
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-300">No credit card required.</p>
          <div className="mt-8">
            <LeadCaptureForm source="landing_footer_cta" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <span className="text-lg font-bold text-white tracking-tight">Comply-Quick</span>
            <p className="mt-2 text-sm text-gray-300 max-w-sm">
              Scan your site&apos;s tech stack and auto-generate every legal document it needs — in under a minute.
            </p>
          </div>
          <div className="md:max-w-sm md:justify-self-end w-full">
            <NewsletterSignup />
          </div>
        </div>
        <div className="max-w-6xl mx-auto pt-8 border-t border-gray-800/50 flex flex-col gap-6">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-gray-300">
            {COMMUNITY_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-300 text-center sm:text-left">
              &copy; {new Date().getFullYear()} Comply-Quick. All rights reserved. This tool does not constitute legal
              advice.
            </p>
            <nav className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
              <a href="#pricing" className="hover:text-gray-200 transition-colors">
                Pricing
              </a>
              <a href="#partners" className="hover:text-gray-200 transition-colors">
                Partners
              </a>
              <Link href="/blog" className="hover:text-gray-200 transition-colors">
                Compliance Guides
              </Link>
              <Link href="/compare/termly" className="hover:text-gray-200 transition-colors">
                Comparisons
              </Link>
              <Link href="/login" className="hover:text-gray-200 transition-colors">
                Log in
              </Link>
              <Link href="/legal/terms" className="hover:text-gray-200 transition-colors">
                Terms of Service
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl px-4 py-6 text-center">
      <div className="text-2xl sm:text-3xl font-bold text-white">{value}</div>
      <div className="mt-1 text-xs text-gray-300 leading-snug">{label}</div>
    </div>
  );
}

function HowItWorksStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8">
      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-5">
        <span className="text-indigo-400 font-bold">{number}</span>
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function ValueProp({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
      <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">{eyebrow}</span>
      <h3 className="mt-2 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{body}</p>
    </div>
  );
}

function Differentiator({ title, body }: { title: string; body: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-7 hover:border-indigo-500/40 transition-colors">
      <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-7 hover:border-indigo-500/40 transition-colors">
      <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function AutopilotStep({ step, title, body }: { step: string; title: string; body: string }) {
  return (
    <article className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6">
      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
        <span className="text-emerald-400 font-bold">{step}</span>
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function PlgCard({ title, body, cta, href }: { title: string; body: string; cta: string; href: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col hover:border-indigo-500/40 transition-colors">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed flex-1">{body}</p>
      <Link href={href} className="mt-4 text-sm font-medium text-indigo-400 hover:text-indigo-300 transition-colors">
        {cta} &rarr;
      </Link>
    </article>
  );
}

function PartnerCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-colors">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function AgentCard({ name, body }: { name: string; body: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-7 hover:border-indigo-500/40 transition-colors">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-400">AI agent</span>
      </div>
      <h3 className="mt-3 text-base sm:text-lg font-semibold text-white">{name}</h3>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function Persona({
  title,
  body,
  points,
  highlight = false,
}: {
  title: string;
  body: string;
  points: string[];
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl p-6 sm:p-8 flex flex-col ${
        highlight
          ? "bg-gray-900 border border-indigo-500/40 ring-1 ring-indigo-500/10"
          : "bg-gray-900 border border-gray-800"
      }`}
    >
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed">{body}</p>
      <ul className="mt-5 space-y-2">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2 text-sm text-gray-200">
            <span className="shrink-0 mt-0.5 text-indigo-400">&#x2713;</span>
            {p}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Testimonial({ quote, name, role, initials }: { quote: string; name: string; role: string; initials: string }) {
  return (
    <figure className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 flex flex-col">
      <blockquote className="text-sm text-gray-200 leading-relaxed flex-1">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-sm font-semibold text-indigo-300">
          {initials}
        </span>
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-white">{name}</span>
          <span className="block text-xs text-gray-300">{role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl sm:text-4xl font-bold text-white">{value}</div>
      <div className="mt-2 text-xs sm:text-sm text-gray-300 leading-snug">{label}</div>
    </div>
  );
}

function TrustBadge({ label }: { label: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl px-3 py-4 flex items-center justify-center text-center">
      <span className="text-xs sm:text-sm font-medium text-gray-200">{label}</span>
    </div>
  );
}

function ComparisonItem({ children, negative = false }: { children: React.ReactNode; negative?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs ${
          negative ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
        }`}
      >
        {negative ? "\u2717" : "\u2713"}
      </span>
      <span className="text-sm text-gray-200">{children}</span>
    </li>
  );
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 [&_summary]:list-none">
      <summary className="flex items-center justify-between cursor-pointer text-white font-medium">
        <span>{question}</span>
        <span className="ml-4 shrink-0 text-gray-300 transition-transform group-open:rotate-45">&#x2b;</span>
      </summary>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed">{children}</p>
    </details>
  );
}
