import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Link from "next/link";
import { TIER_CONFIG } from "@/lib/pricing";
import { HeroScan } from "@/components/landing/HeroScan";
import { StructuredData } from "@/components/seo/StructuredData";
import { Logo } from "@/components/brand/Logo";
import { LANDING_FAQ } from "@/lib/landing/faq";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";
const SITE_ORIGIN = SITE_URL.endsWith("/") ? SITE_URL.slice(0, -1) : SITE_URL;
const CANONICAL_URL = `${SITE_ORIGIN}/`;
const OG_IMAGE_URL = `${SITE_ORIGIN}/opengraph-image.png`;

// UTM-tagged funnel entry so landing-sourced signups are attributable.
const START_HREF = "/dashboard?utm_source=landing&utm_medium=cta&utm_campaign=free_scan";
const SCAN_HREF = "#get-started";
const PRICING_HREF = "#pricing";
const CONTACT_HREF = "mailto:support@comply-quick.com?subject=Enterprise%20inquiry";
const ExitIntentCapture = dynamic(() =>
  import("@/components/landing/ExitIntentCapture").then((m) => m.ExitIntentCapture)
);
const PricingPlans = dynamic(() => import("@/components/landing/PricingPlans").then((m) => m.PricingPlans), {
  loading: () => <div className="h-64 rounded-2xl border border-gray-800 bg-gray-900/50" />,
});
const AgencyRevenueCalculator = dynamic(
  () => import("@/components/landing/AgencyRevenueCalculator").then((m) => m.AgencyRevenueCalculator),
  {
    loading: () => <div className="h-52 rounded-2xl border border-gray-800 bg-gray-900/50" />,
  }
);
const LeadCaptureForm = dynamic(() => import("@/components/landing/LeadCaptureForm").then((m) => m.LeadCaptureForm), {
  loading: () => <div className="h-24 rounded-xl border border-gray-800 bg-gray-900/50" />,
});
const NewsletterSignup = dynamic(
  () => import("@/components/landing/NewsletterSignup").then((m) => m.NewsletterSignup),
  {
    loading: () => <div className="h-24 rounded-xl border border-gray-800 bg-gray-900/50" />,
  }
);

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
  title: "Comply-Quick — White-Label Compliance for Agencies | Scan, Generate & Auto-Update",
  description:
    "Agencies ship fully compliant client sites in under a minute — white-labeled, automated, and billable. One-click scan of your client's tech stack auto-generates tailored privacy policies, cookie disclosures & waivers, and Autopilot keeps the documents current as the law changes.",
  keywords: [
    "agency compliance tool",
    "white-label privacy policy generator",
    "website compliance software",
    "GDPR compliance software",
    "CCPA compliance",
    "cookie consent",
    "cookie policy generator",
    "privacy policy generator",
    "data privacy compliance",
    "compliance automation software",
    "ADA website compliance",
    "developer liability waiver",
  ],
  applicationName: "Comply-Quick",
  category: "Compliance software",
  alternates: {
    canonical: CANONICAL_URL,
    languages: { "en-US": CANONICAL_URL },
  },
  openGraph: {
    type: "website",
    url: CANONICAL_URL,
    siteName: "Comply-Quick",
    title: "White-Label Compliance for Agencies — Scan, Generate & Auto-Update",
    description:
      "Scan any client site in one click, auto-generate tailored compliance documents, and let Autopilot keep them current as regulations change. White-labeled, automated, and billable.",
    images: [
      {
        url: OG_IMAGE_URL,
        width: 1200,
        height: 630,
        alt: "Comply-Quick dashboard with automated compliance scan and score",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Comply-Quick — White-Label Compliance for Agencies",
    description:
      "One-click tech-stack scan, tailored compliance documents auto-generated, and Autopilot that auto-updates them as the law changes.",
    images: [OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <StructuredData />
      <ExitIntentCapture />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Founding 100 promo bar */}
      <div className="bg-indigo-600 text-white text-center text-xs sm:text-sm font-medium px-4 py-2">
        Founding 100: the first 100 members get a free premium scan.{" "}
        <a href={SCAN_HREF} className="underline underline-offset-2 hover:text-indigo-100">
          Claim Your Spot &rarr;
        </a>
      </div>

      {/* Navigation */}
      <nav className="sticky top-0 z-30 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Logo href="/" tone="dark" size="md" />
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              How It Works
            </a>
            <a
              href="#pricing"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="text-sm font-medium text-gray-200 hover:text-white transition-colors hidden sm:inline"
            >
              FAQ
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
              Log In
            </Link>
            <Link
              href={START_HREF}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 transition-colors"
            >
              Create Free Agency Account
            </Link>
          </div>
        </div>
      </nav>
      <main id="main-content">
        {/* ── §1 Hero — Agency Revenue Engine ─────────────────────────────── */}
        <header className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            {/* Left: message + scan */}
            <div>
              <Logo tone="dark" size="lg" tagline className="mb-7" />
              <div className="inline-block mb-5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                <span className="text-xs font-medium text-indigo-400">
                  One-click website scan &middot; tailored compliance documents &middot; auto-updated
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight">
                Agencies Ship Fully Compliant Client Sites in Under a Minute &mdash; White-Labeled, Automated, and
                Billable.
              </h1>
              <p className="mt-5 text-lg text-gray-200 leading-relaxed">
                Scan any client site. Auto-generate every policy. Shift liability off your agency. Deliver compliance as
                a recurring revenue stream.
              </p>
              <div id="get-started" className="mt-8 scroll-mt-24">
                <HeroScan startHref={START_HREF} />
              </div>
              <p className="mt-4 text-xs text-gray-300">
                One click scans your client&apos;s live tech stack and generates documents tailored to their exact site
                &mdash; no questionnaires, no templates.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <a
                  href={SCAN_HREF}
                  className="px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold text-center hover:bg-indigo-500 transition-colors"
                >
                  Run a Free Compliance Scan
                </a>
                <Link
                  href={START_HREF}
                  className="px-7 py-3.5 rounded-xl border border-gray-700 text-gray-200 font-medium text-center hover:border-gray-500 hover:text-white transition-colors"
                >
                  Create Free Agency Account
                </Link>
              </div>
              {/* Purchase-risk reducers (all truthful: see pricing + FAQ) */}
              <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-300">
                {["No Credit Card Required", "30-Day Money-Back Guarantee", "Cancel Anytime"].map((point) => (
                  <li key={point} className="inline-flex items-center gap-1.5">
                    <svg
                      className="w-3.5 h-3.5 text-emerald-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4l3.1 3.1 6.8-6.8a1 1 0 011.4 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {point}
                  </li>
                ))}
              </ul>
              {/* Trust bar */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-gray-300">
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-amber-400">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                  <span>4.9/5</span>
                </span>
                <span className="hidden sm:inline text-gray-600">&bull;</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  2,400+ Sites Scanned
                </span>
                <span className="hidden sm:inline text-gray-600">&bull;</span>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-2 py-1">
                  <span className="text-[#da552f] font-bold">P</span>
                  Featured on Product Hunt
                </span>
              </div>
            </div>

            {/* Right: white-label export + compliance score badge preview */}
            <div className="relative">
              <div className="rounded-3xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6 shadow-2xl">
                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-indigo-500/20 border border-indigo-500/30" />
                    <span className="text-sm font-semibold text-white">Your Agency</span>
                    <span className="text-[10px] uppercase tracking-wider text-indigo-300 border border-indigo-500/30 rounded px-1.5 py-0.5">
                      White-Label
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">client-export.pdf</span>
                </div>
                <div className="mt-5 space-y-3">
                  <MockDoc label="Privacy Policy" />
                  <MockDoc label="Cookie Disclosures" />
                  <MockDoc label="Liability Waiver" />
                  <MockDoc label="Pre-Launch Checklist" />
                </div>
                <div className="mt-6 flex items-center justify-between rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-emerald-300">Compliance score</div>
                    <div className="text-xs text-gray-300 mt-1">Embeddable Trust Badge</div>
                  </div>
                  <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-emerald-400/60 text-xl font-bold text-white">
                    94
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Trust bar — social proof logos */}
        <section className="px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
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
            {/* Framework coverage — factual breadth of what the engine maps to. */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
              {["GDPR", "CCPA / CPRA", "PIPEDA", "LGPD", "ADA / WCAG", "HIPAA", "PCI-DSS", "SOC 2"].map((fw) => (
                <span
                  key={fw}
                  className="inline-flex items-center rounded-full border border-gray-700 bg-gray-900/60 px-3 py-1 text-xs font-medium text-gray-200"
                >
                  {fw}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── §2 Agency Value Proposition ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                Turn Compliance Into Recurring Revenue &mdash; Without Doing the Work.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <ValueColumn
                title="Unlimited Client Sites"
                body="Manage every client from one dashboard. White-label every export."
              />
              <ValueColumn
                title="Agency Liability Shield™"
                body="Shift GDPR/ADA liability from your agency to the merchant automatically."
              />
              <ValueColumn
                title="Regulation Autopilot"
                body="AI agents monitor 26+ regulatory sources and update documents automatically."
              />
            </div>
            <div className="mt-10 text-center">
              <a
                href={PRICING_HREF}
                className="inline-block px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                Explore Agency Plan
              </a>
            </div>
          </div>
        </section>

        {/* ── Dedicated AI Compliance Agent + Autopilot (emphasized) ──────── */}
        <section className="px-4 sm:px-6 lg:px-8 pb-4">
          <div className="max-w-6xl mx-auto rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-emerald-600/10 via-indigo-600/5 to-transparent p-8 sm:p-12">
            <div className="text-center max-w-3xl mx-auto">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
                Agency &amp; Enterprise &middot; AI Compliance Agent
              </span>
              <h2 className="mt-4 text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
                A Dedicated AI Compliance Agent &mdash; and Autopilot That Keeps Your Documents Current.
              </h2>
              <p className="mt-4 text-gray-200 leading-relaxed">
                Agency and Enterprise plans include a dedicated AI Compliance Agent that continuously watches{" "}
                <span className="text-white font-medium">26+ official federal and state regulatory sources</span>. The
                moment a rule changes, Regulation Autopilot{" "}
                <span className="text-white font-medium">
                  automatically re-drafts the affected policies, disclosures, and an implementation strategy
                </span>{" "}
                &mdash; ready for you to review and publish. You stay in control of what goes live on the site.
              </p>
            </div>
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <AiCard
                title="Dedicated AI Compliance Agent"
                body="Assigned to your account on Agency and Enterprise. It owns the scanning, drafting, and monitoring workflow across every client site."
              />
              <AiCard
                title="Auto-Updating Compliance Documents"
                body="When regulations move, your generated policies, cookie disclosures, and waivers are re-drafted automatically so they never go stale."
              />
              <AiCard
                title="You Review and Publish"
                body="Every update arrives with a clear implementation strategy. You review it and publish to the site — Comply-Quick never changes a live site on its own."
              />
            </div>
          </div>
        </section>

        {/* ── §3 Before & After Transformation ────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-white">Before Comply-Quick</h3>
              <ul className="mt-6 space-y-4">
                {[
                  "3\u20135 Days to Produce Compliance Docs",
                  "Manual Updates Every Time Laws Change",
                  "Liability Sits on the Agency",
                  "No Recurring Revenue",
                  "No White-Label Deliverables",
                ].map((item) => (
                  <BeforeAfterItem key={item} negative>
                    {item}
                  </BeforeAfterItem>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/5 p-6 sm:p-8">
              <h3 className="text-lg font-semibold text-white">After Comply-Quick</h3>
              <ul className="mt-6 space-y-4">
                {[
                  "Full Package in <60 Seconds",
                  "Automated Updates Forever",
                  "Liability Shifted to the Merchant",
                  "Recurring Revenue From Compliance Autopilot",
                  "White-Label Exports for Every Client",
                ].map((item) => (
                  <BeforeAfterItem key={item}>{item}</BeforeAfterItem>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ── §4 How It Works (Agency Edition) ────────────────────────────── */}
        <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Agency edition</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">How It Works</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <Step
                number="1"
                title="Scan the Client Site"
                body="One click detects platform, pixels, frameworks, and jurisdictions automatically."
              />
              <Step
                number="2"
                title="Auto-Generate the Full Package"
                body="Privacy policy, cookie disclosures, liability waivers, pre-launch checklist."
              />
              <Step
                number="3"
                title="Deliver It White-Labeled"
                body="Export under your brand. Add recurring compliance monitoring."
              />
            </div>
            <div className="mt-10 text-center">
              <a
                href={SCAN_HREF}
                className="inline-block px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                Run a Free Scan
              </a>
            </div>
          </div>
        </section>

        {/* ── §5 Agency Dashboard Preview ─────────────────────────────────── */}
        <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                One Dashboard for Every Client. Unlimited Sites. Team Roles. White-Label Everything.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
              <DashboardPanel label="Multi-Client Dashboard" rows={4} />
              <DashboardPanel label="White-Label Export Modal" rows={3} />
              <DashboardPanel label="Compliance Score + Badge" score />
              <DashboardPanel label="Findings & Remediation Workspace" rows={4} />
            </div>
          </div>
        </section>

        {/* ── §6 Core Differentiators ─────────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight max-w-3xl mx-auto">
                Built Differently &mdash; Because We Start From Your Live Site, Not a Form.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[
                "Scan-First Detection",
                "Stack-Aware Documents",
                "Developer Liability Shield",
                "Regulation Autopilot",
                "Compliance Marketplace",
                "Embeddable Score Badges",
              ].map((label) => (
                <DiffBullet key={label}>{label}</DiffBullet>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Link
                href="/compare/termly"
                className="inline-block px-7 py-3.5 rounded-xl border border-gray-700 text-gray-200 font-medium hover:border-gray-500 hover:text-white transition-colors"
              >
                See the Difference
              </Link>
            </div>
          </div>
        </section>

        {/* ── §7 Agency Revenue Calculator ────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">See your numbers</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Agency Revenue Calculator</h2>
            </div>
            <AgencyRevenueCalculator startHref={START_HREF} />
          </div>
        </section>

        {/* ── §8 Testimonials ─────────────────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Agencies and Freelancers, in Their Words.</h2>
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
            <div className="mt-10 text-center">
              <a
                href={SCAN_HREF}
                className="inline-block px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                Run a Free Scan
              </a>
            </div>
          </div>
        </section>

        {/* ── §9 Pricing (Agency-First) ───────────────────────────────────── */}
        <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50 scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Simple, Transparent Pricing.</h2>
              <p className="mt-4 text-base text-indigo-300 font-medium max-w-xl mx-auto">
                Less than one billable hour &mdash; for unlimited client compliance packages.
              </p>
            </div>
            <p className="text-center text-xs text-gray-300 mb-10 sm:mb-14">
              Average attorney compliance review: $2,000 &ndash; $5,000. Comply-Quick starts at $
              {TIER_CONFIG.solo.monthly}
              /mo.
            </p>
            <PricingPlans startHref={START_HREF} />
            <p className="mt-8 text-center text-xs text-gray-300">
              30-day money-back guarantee on all plans. No questions asked.
            </p>
          </div>
        </section>

        {/* ── §10 Partner Program ─────────────────────────────────────────── */}
        <section id="partners" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50 scroll-mt-20">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Partner program</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">
                Earn Recurring Revenue on Every Client You Bring.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              <PartnerCard title="Resell Under Your Brand" />
              <PartnerCard title="Bundle Compliance Into Every Build" />
              <PartnerCard title="Earn Recurring Commissions" />
            </div>
            <div className="mt-10 text-center">
              <Link
                href={START_HREF}
                className="inline-block px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                Become a Partner
              </Link>
            </div>
          </div>
        </section>

        {/* ── §11 Developer & Freelancer ──────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-4xl mx-auto rounded-3xl border border-gray-800 bg-gray-900/60 p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              For Freelancers &amp; Solo Devs &mdash; Deliver Professional Compliance on Every Build.
            </h2>
            <ul className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {["Full Package per Project", "Contract Shield Included", "Cancel Anytime"].map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-3 rounded-2xl border border-gray-800 bg-gray-900/60 p-4"
                >
                  <span className="shrink-0 mt-0.5 text-indigo-400">&#x2713;</span>
                  <span className="text-sm text-gray-200">{point}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <a
                href={SCAN_HREF}
                className="inline-block px-7 py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                Run a Free Scan
              </a>
            </div>
          </div>
        </section>

        {/* ── §12 Enterprise (shortened) ──────────────────────────────────── */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-4xl mx-auto text-center rounded-3xl border border-amber-500/25 bg-gradient-to-b from-amber-600/10 to-transparent p-8 sm:p-12">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">Enterprise</span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white leading-tight">
              Enterprise Compliance Stack &mdash; HIPAA, PCI-DSS, ADA/WCAG, SOC 2.
            </h2>
            <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
              Plus a{" "}
              <span className="text-white font-medium">dedicated AI Compliance Agent assigned to your account</span>,
              unlimited seats and scans, SSO, and dedicated onboarding.
            </p>
            <div className="mt-8">
              <a
                href={CONTACT_HREF}
                className="inline-block px-7 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold hover:from-amber-500 hover:to-orange-500 transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </section>

        {/* Resources / SEO */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">Resources</span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white">Learn, Compare, Decide.</h2>
              <p className="mt-4 text-gray-200 max-w-2xl mx-auto">
                Free guides to common compliance questions and honest comparisons with the tools you may be weighing.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <PlgCard
                title="Compliance Guides"
                body="Plain-English answers to GDPR, CCPA, cookie-consent, and ADA questions for real websites."
                cta="Read the Guides"
                href="/blog"
              />
              <PlgCard
                title="Comply-Quick vs Termly"
                body="How scan-first detection and regulation autopilot compare to template-based generation."
                cta="See the Comparison"
                href="/compare/termly"
              />
              <PlgCard
                title="Comply-Quick vs iubenda"
                body="Documents driven by your live stack, plus a developer liability shield and agency white-label."
                cta="See the Comparison"
                href="/compare/iubenda"
              />
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-white">Questions, Answered.</h2>
            </div>
            <div className="space-y-4">
              {LANDING_FAQ.map((item) => (
                <FaqItem key={item.q} question={item.q}>
                  {item.a}
                </FaqItem>
              ))}
            </div>
          </div>
        </section>

        {/* ── §13 Final CTA ───────────────────────────────────────────────── */}
        <section className="px-4 sm:px-6 lg:px-8 py-16 sm:py-24 border-t border-gray-800/50">
          <div className="max-w-4xl mx-auto text-center bg-gradient-to-b from-indigo-600/10 to-transparent border border-indigo-500/20 rounded-3xl px-6 py-12 sm:py-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight">
              Know Exactly Where Your Site Stands &mdash; in 60 Seconds.
            </h2>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={SCAN_HREF}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-colors text-center"
              >
                Scan Your Site Free
              </a>
              <Link
                href={START_HREF}
                className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-700 text-gray-200 font-medium text-base hover:border-gray-500 hover:text-white transition-colors text-center"
              >
                Create Free Agency Account
              </Link>
            </div>
            <p className="mt-4 text-xs text-gray-300">No Credit Card Required.</p>
            <div className="mt-8">
              <LeadCaptureForm source="landing_footer_cta" />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto mb-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div>
            <Logo tone="dark" size="lg" tagline />
            <p className="mt-4 text-sm text-gray-300 max-w-sm">
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
              <a href="#how-it-works" className="hover:text-gray-200 transition-colors">
                How It Works
              </a>
              <a href="#partners" className="hover:text-gray-200 transition-colors">
                Partners
              </a>
              <a href="#faq" className="hover:text-gray-200 transition-colors">
                FAQ
              </a>
              <Link href="/blog" className="hover:text-gray-200 transition-colors">
                Compliance Guides
              </Link>
              <Link href="/compare/termly" className="hover:text-gray-200 transition-colors">
                Comparisons
              </Link>
              <Link href="/login" className="hover:text-gray-200 transition-colors">
                Log In
              </Link>
              <Link href="/legal/terms" className="hover:text-gray-200 transition-colors">
                Terms of Service
              </Link>
              <Link href="/legal/privacy" className="hover:text-gray-200 transition-colors">
                Privacy Policy
              </Link>
              <Link href="/legal" className="hover:text-gray-200 transition-colors">
                Legal Center
              </Link>
              <Link href="/legal/packet" className="hover:text-gray-200 transition-colors">
                Counsel Packet
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function MockDoc({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
      <span className="shrink-0 w-8 h-8 rounded-md bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-300 text-xs font-semibold">
        &#x2713;
      </span>
      <span className="text-sm text-gray-200">{label}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">Ready</span>
    </div>
  );
}

function ValueColumn({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6 sm:p-8">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="mt-3 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function AiCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6">
      <div className="flex items-center gap-2.5">
        <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/60" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">AI agent</span>
      </div>
      <h3 className="mt-3 text-base sm:text-lg font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-gray-200 leading-relaxed">{body}</p>
    </article>
  );
}

function BeforeAfterItem({ children, negative = false }: { children: React.ReactNode; negative?: boolean }) {
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

function Step({ number, title, body }: { number: string; title: string; body: string }) {
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

function DashboardPanel({ label, rows = 0, score = false }: { label: string; rows?: number; score?: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-gray-800 pb-3">
        <span className="text-sm font-semibold text-white">{label}</span>
        <span className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-700" />
          <span className="w-2 h-2 rounded-full bg-gray-700" />
          <span className="w-2 h-2 rounded-full bg-gray-700" />
        </span>
      </div>
      {score ? (
        <div className="mt-5 flex items-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-emerald-400/60 text-xl font-bold text-white">
            94
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2.5 rounded bg-emerald-500/40 w-3/4" />
            <div className="h-2.5 rounded bg-gray-800 w-1/2" />
            <div className="h-6 rounded bg-indigo-500/20 border border-indigo-500/30 w-24 mt-3" />
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-8 h-8 rounded-md bg-gray-800 shrink-0" />
              <span className="h-2.5 rounded bg-gray-800" style={{ width: `${70 - i * 10}%` }} />
              <span className="ml-auto h-5 w-12 rounded bg-emerald-500/15 border border-emerald-500/25" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiffBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-800 bg-gray-900/60 p-4 sm:p-5 hover:border-indigo-500/40 transition-colors">
      <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-300 text-xs">
        &#x2713;
      </span>
      <span className="text-sm sm:text-base font-medium text-white">{children}</span>
    </div>
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

function PartnerCard({ title }: { title: string }) {
  return (
    <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center gap-3 hover:border-indigo-500/40 transition-colors">
      <span className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-300 text-xs">
        &#x2713;
      </span>
      <h3 className="text-base font-semibold text-white">{title}</h3>
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
