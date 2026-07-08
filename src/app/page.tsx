import type { Metadata } from "next";
import Link from "next/link";
import PricingSection from "@/components/PricingSection";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com";

// UTM-tagged funnel entry so landing-sourced signups are attributable.
const START_HREF = "/dashboard?utm_source=landing&utm_medium=cta&utm_campaign=free_scan";
const PRICING_HREF = "#pricing";

export const metadata: Metadata = {
  title: "Comply-Quick — Instant Web Compliance Packages for Agencies & Freelancers",
  description:
    "Scan any site for GDPR, CCPA & ADA risks in 30 seconds, then generate the liability waivers, privacy policies, and pre-launch checklist mapped to its exact tech stack. Free preview — no card required.",
  keywords: [
    "web compliance",
    "GDPR compliance tool",
    "CCPA compliance",
    "privacy policy generator",
    "developer liability waiver",
    "agency compliance",
    "cookie tracking compliance",
  ],
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Comply-Quick",
    title: "Instant Web Compliance Packages — mapped to your exact tech stack",
    description:
      "Scan for GDPR/CCPA/ADA risk in 30s and auto-generate the waivers, policies, and checklist that shift liability off your agency. Free preview, no card required.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Comply-Quick — Instant Web Compliance Packages",
    description:
      "Scan for GDPR/CCPA/ADA risk in 30 seconds and generate stack-specific waivers, policies & checklists. Free preview.",
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navigation */}
      <nav className="sticky top-0 z-30 border-b border-gray-800/50 bg-gray-950/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-white tracking-tight">Comply-Quick</span>
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="#pricing"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:inline"
            >
              Pricing
            </a>
            <Link
              href="/blog"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:inline"
            >
              Guides
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-400 hover:text-white transition-colors hidden sm:inline"
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
              Works with Shopify, WooCommerce, BigCommerce, WordPress, Webflow &amp; 4 more
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
            The compliance layer agencies install once and never worry about again.
          </h1>
          <p className="mt-6 text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Comply-Quick scans any website for GDPR, CCPA &amp; ADA risk in 30 seconds, then auto-generates the
            liability waivers, privacy policies, and pre-launch checklist mapped to its{" "}
            <span className="text-gray-200">exact</span> tech stack. Stop risking personal liability over a tracking
            pixel your client forgot to mention.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={START_HREF}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-colors text-center"
            >
              Scan your site free
            </Link>
            <a
              href={PRICING_HREF}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-700 text-gray-300 font-medium text-base hover:border-gray-500 hover:text-white transition-colors text-center"
            >
              View pricing
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Free scan included &mdash; see your compliance score and contract shield before you pay. No credit card
            required.
          </p>
        </div>
      </header>

      {/* Trust bar */}
      <section className="px-4 sm:px-6 lg:px-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-xs font-medium text-gray-600 uppercase tracking-widest mb-6">
            Built for agencies and freelancers shipping on
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {["Webflow", "WordPress", "Shopify", "Next.js", "Wix", "Squarespace", "GoDaddy"].map((name) => (
              <span key={name} className="text-sm font-semibold text-gray-600 hover:text-gray-400 transition-colors">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Proof / capability stats */}
      <section className="px-4 sm:px-6 lg:px-8 pb-4">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <Stat value="30 sec" label="From URL to full package" />
          <Stat value="9" label="Platforms mapped" />
          <Stat value="6" label="Jurisdictions covered" />
          <Stat value="6" label="Tracking pixels detected" />
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
            <p className="mt-4 text-gray-400 max-w-xl mx-auto">
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

      {/* Pricing Section — client component with annual billing toggle */}
      <PricingSection />

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
            See your site&apos;s compliance risk in 30 seconds.
          </h2>
          <p className="mt-4 text-gray-400 max-w-xl mx-auto">
            Run a free scan, get your score, and preview the liability shield before you pay a cent.
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
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-700 text-gray-300 font-medium text-base hover:border-gray-500 hover:text-white transition-colors text-center"
            >
              View pricing
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-500">No credit card required.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500 text-center sm:text-left">
            &copy; {new Date().getFullYear()} Comply-Quick. All rights reserved. This tool does not constitute legal
            advice.
          </p>
          <nav className="flex items-center gap-4 text-xs text-gray-500">
            <a href="#pricing" className="hover:text-gray-300 transition-colors">
              Pricing
            </a>
            <Link href="/blog" className="hover:text-gray-300 transition-colors">
              Compliance Guides
            </Link>
            <Link href="/login" className="hover:text-gray-300 transition-colors">
              Log in
            </Link>
            <Link href="/legal/terms" className="hover:text-gray-300 transition-colors">
              Terms of Service
            </Link>
          </nav>
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
      <div className="mt-1 text-xs text-gray-500 leading-snug">{label}</div>
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
      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{body}</p>
    </article>
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
      <span className="text-sm text-gray-300">{children}</span>
    </li>
  );
}

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group bg-gray-900 border border-gray-800 rounded-2xl p-5 sm:p-6 [&_summary]:list-none">
      <summary className="flex items-center justify-between cursor-pointer text-white font-medium">
        <span>{question}</span>
        <span className="ml-4 shrink-0 text-gray-500 transition-transform group-open:rotate-45">&#x2b;</span>
      </summary>
      <p className="mt-3 text-sm text-gray-400 leading-relaxed">{children}</p>
    </details>
  );
}
