import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Navigation */}
      <nav className="border-b border-gray-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-white tracking-tight">Comply-Quick</span>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/home"
              className="text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors hidden sm:inline"
            >
              Dashboard
            </Link>
            <Link href="/dashboard" className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              Launch App &rarr;
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="py-20 sm:py-28 lg:py-36 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-6 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
            <span className="text-xs font-medium text-indigo-400">
              Used by Shopify, WooCommerce, BigCommerce, WordPress, Webflow &amp; more
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
            The 30-Second Liability Shield for Web Agencies &amp; Freelancers.
          </h1>
          <p className="mt-6 text-base sm:text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Answer 4 questions about your tech stack. Get a ready-to-deploy liability shield, privacy policy, and
            pre-launch checklist &mdash; with a compliance score.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-indigo-600 text-white font-semibold text-base hover:bg-indigo-500 transition-colors text-center"
            >
              Generate Your Compliance Package
            </Link>
            <a
              href="#pricing"
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-gray-700 text-gray-300 font-medium text-base hover:border-gray-500 hover:text-white transition-colors text-center"
            >
              View Pricing
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            Free preview included &mdash; see your compliance score and contract shield before you pay.
          </p>
        </div>
      </header>

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

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Simple, transparent pricing.</h2>
            <p className="mt-4 text-gray-400 max-w-lg mx-auto">
              Choose the plan that fits your workflow. No hidden fees, no surprise charges.
            </p>
          </div>

          {/* Pricing anchor */}
          <p className="text-center text-xs text-gray-500 mb-10 sm:mb-14">
            Average attorney compliance review: $2,000 &ndash; $5,000. Comply-Quick starts at $12.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Single Project Pass */}
            <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 flex flex-col">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">Single Project Pass</h3>
                <p className="mt-1 text-xs text-gray-500">One project. Lifetime access. No subscription.</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">$12</span>
                  <span className="text-sm text-gray-400">one-time</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <PricingFeature>One-time payment</PricingFeature>
                <PricingFeature>Lifetime access to one configuration snapshot</PricingFeature>
                <PricingFeature>Direct markdown download</PricingFeature>
                <PricingFeature>Full contract shield + privacy addendum + checklist</PricingFeature>
                <PricingFeature>Compliance score breakdown</PricingFeature>
              </ul>
              <Link
                href="/dashboard"
                className="block w-full py-3 px-4 rounded-xl border border-gray-700 text-center text-white font-medium hover:border-gray-500 hover:bg-gray-800 transition-colors"
              >
                Get Started
              </Link>
            </article>

            {/* Agency Scale Plan */}
            <article className="bg-gray-900 border border-indigo-500/40 rounded-2xl p-6 sm:p-8 flex flex-col ring-1 ring-indigo-500/10 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                <span className="text-xs font-medium text-indigo-300">Most Popular</span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">Agency Scale Plan</h3>
                <p className="mt-1 text-xs text-gray-500">Unlimited projects for growing teams.</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">$29</span>
                  <span className="text-sm text-gray-400">/month</span>
                </div>
                <p className="mt-1 text-xs text-emerald-400">or $290/yr &mdash; save ~17%</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <PricingFeature>Unlimited project generations</PricingFeature>
                <PricingFeature>Team seats included</PricingFeature>
                <PricingFeature>Automated regulatory clause updates</PricingFeature>
                <PricingFeature>Priority support</PricingFeature>
                <PricingFeature>All 9 platforms, 6 pixels, and 6 regions</PricingFeature>
              </ul>
              <Link
                href="/dashboard"
                className="block w-full py-3 px-4 rounded-xl bg-indigo-600 text-center text-white font-semibold hover:bg-indigo-500 transition-colors"
              >
                Start Free Trial
              </Link>
            </article>

            {/* Enterprise Tier */}
            <article className="bg-gray-900 border border-amber-500/40 rounded-2xl p-6 sm:p-8 flex flex-col ring-1 ring-amber-500/10 relative overflow-hidden">
              <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
                <span className="text-xs font-medium text-amber-300">Enterprise</span>
              </div>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">Enterprise Tier</h3>
                <p className="mt-1 text-xs text-gray-500">Full compliance stack for regulated industries.</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">$99</span>
                  <span className="text-sm text-gray-400">/month</span>
                </div>
                <p className="mt-1 text-xs text-emerald-400">or $990/yr &mdash; save ~17%</p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                <PricingFeature>Everything in Agency, plus:</PricingFeature>
                <PricingFeature>HIPAA compliance shield</PricingFeature>
                <PricingFeature>PCI-DSS payment security module</PricingFeature>
                <PricingFeature>ADA / WCAG accessibility compliance</PricingFeature>
                <PricingFeature>SOC 2 security controls shield</PricingFeature>
                <PricingFeature>REST API access for automation</PricingFeature>
                <PricingFeature>White-label markdown exports</PricingFeature>
                <PricingFeature>Dedicated onboarding support</PricingFeature>
              </ul>
              <Link
                href="/dashboard"
                className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-center text-white font-semibold hover:from-amber-500 hover:to-orange-500 transition-all"
              >
                Contact Sales
              </Link>
            </article>
          </div>

          {/* Guarantee */}
          <p className="mt-8 text-center text-xs text-gray-500">
            30-day money-back guarantee on all plans. No questions asked.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Comply-Quick. All rights reserved. This tool does not constitute legal
            advice.
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

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

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center">
        <span className="text-xs text-indigo-400">&#x2713;</span>
      </span>
      <span className="text-sm text-gray-300">{children}</span>
    </li>
  );
}
