"use client";

// GTM: Pricing section with annual billing toggle and Free tier card.
// Extracted as a client component so the toggle can hold local state while
// the parent landing page stays a server component.

import { useState } from "react";
import Link from "next/link";
import { TIER_CONFIG } from "@/lib/pricing";

const START_HREF = "/dashboard?utm_source=landing&utm_medium=cta&utm_campaign=free_scan";
const FREE_SOCIAL_PROOF = "No credit card. No commitment.";
const SOLO_SOCIAL_PROOF = "Loved by 400+ freelancers & solo devs.";
const AGENCY_SOCIAL_PROOF = "Trusted by agencies in 12+ countries.";
const ENTERPRISE_SOCIAL_PROOF = "For regulated industries & large teams.";

function CheckIcon() {
  return (
    <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center">
      <span className="text-xs text-indigo-400">&#x2713;</span>
    </span>
  );
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <CheckIcon />
      <span className="text-sm text-gray-300">{children}</span>
    </li>
  );
}

export default function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const isAnnual = billing === "annual";

  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-t border-gray-800/50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Simple, transparent pricing.</h2>
          <p className="mt-4 text-gray-400 max-w-lg mx-auto">
            Start free. Upgrade when you need more scans, more clients, or more power.
          </p>
        </div>

        {/* Annual toggle */}
        <div className="flex items-center justify-center gap-3 mt-6 mb-2">
          <span className={`text-sm font-medium ${!isAnnual ? "text-white" : "text-gray-500"}`}>Monthly</span>
          <button
            onClick={() => setBilling(isAnnual ? "monthly" : "annual")}
            aria-pressed={isAnnual}
            aria-label="Toggle annual billing"
            className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isAnnual ? "bg-indigo-600" : "bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isAnnual ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${isAnnual ? "text-white" : "text-gray-500"}`}>
            Annual{" "}
            <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-xs font-semibold">
              Save ~17%
            </span>
          </span>
        </div>

        {/* Pricing anchor */}
        <p className="text-center text-xs text-gray-500 mb-10 sm:mb-14">
          Average attorney compliance review: $2,000&ndash;$5,000. Comply-Quick starts free.
        </p>

        {/* 4-column pricing grid: Free | Solo | Agency | Enterprise */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Free Tier */}
          <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white">{TIER_CONFIG.free.label}</h3>
              <p className="mt-1 text-xs text-gray-500">Try it with no commitment, ever.</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">$0</span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">&nbsp;</p>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              <PricingFeature>{TIER_CONFIG.free.scanLimit} compliance scan / month</PricingFeature>
              <PricingFeature>Compliance score + risk summary</PricingFeature>
              <PricingFeature>Preview of your liability waiver</PricingFeature>
              <PricingFeature>No credit card required</PricingFeature>
            </ul>
            <p className="mb-4 text-xs text-gray-500 text-center">{FREE_SOCIAL_PROOF}</p>
            <Link
              href={START_HREF}
              className="block w-full py-3 px-4 rounded-xl border border-gray-700 text-center text-white font-medium hover:border-gray-500 hover:bg-gray-800 transition-colors"
            >
              Start free
            </Link>
          </article>

          {/* Solo Plan */}
          <article className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white">{TIER_CONFIG.solo.label}</h3>
              <p className="mt-1 text-xs text-gray-500">For freelancers &amp; solo devs. Cancel anytime.</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${isAnnual ? Math.round(TIER_CONFIG.solo.annual / 12) : TIER_CONFIG.solo.monthly}
                </span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              {isAnnual ? (
                <p className="mt-1 text-xs text-emerald-400">${TIER_CONFIG.solo.annual}/yr billed annually</p>
              ) : (
                <p className="mt-1 text-xs text-emerald-400">or ${TIER_CONFIG.solo.annual}/yr &mdash; save ~17%</p>
              )}
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              <PricingFeature>{TIER_CONFIG.solo.scanLimit} compliance scans / month</PricingFeature>
              <PricingFeature>Full contract shield + privacy addendum</PricingFeature>
              <PricingFeature>Pre-launch compliance checklist</PricingFeature>
              <PricingFeature>Compliance score breakdown</PricingFeature>
              <PricingFeature>Markdown download</PricingFeature>
            </ul>
            <p className="mb-4 text-xs text-gray-500 text-center">{SOLO_SOCIAL_PROOF}</p>
            <Link
              href={START_HREF}
              className="block w-full py-3 px-4 rounded-xl border border-gray-700 text-center text-white font-medium hover:border-gray-500 hover:bg-gray-800 transition-colors"
            >
              Get Started
            </Link>
          </article>

          {/* Agency Plan — Most Popular */}
          <article className="bg-gray-900 border border-indigo-500/40 rounded-2xl p-6 flex flex-col ring-1 ring-indigo-500/10 relative overflow-hidden">
            <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30">
              <span className="text-xs font-medium text-indigo-300">Most Popular</span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white">{TIER_CONFIG.agency.label}</h3>
              <p className="mt-1 text-xs text-gray-500">For agencies managing multiple client sites.</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${isAnnual ? Math.round(TIER_CONFIG.agency.annual / 12) : TIER_CONFIG.agency.monthly}
                </span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              {isAnnual ? (
                <p className="mt-1 text-xs text-emerald-400">${TIER_CONFIG.agency.annual}/yr billed annually</p>
              ) : (
                <p className="mt-1 text-xs text-emerald-400">or ${TIER_CONFIG.agency.annual}/yr &mdash; save ~17%</p>
              )}
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              <PricingFeature>{TIER_CONFIG.agency.scanLimit} compliance scans / month</PricingFeature>
              <PricingFeature>{TIER_CONFIG.agency.seats} team seats included</PricingFeature>
              <PricingFeature>Ongoing monitoring + automated regulatory updates</PricingFeature>
              <PricingFeature>White-label exports &amp; priority support</PricingFeature>
              <PricingFeature>All 9 platforms, 6 pixels, and 6 regions</PricingFeature>
            </ul>
            <p className="mb-4 text-xs text-gray-500 text-center">{AGENCY_SOCIAL_PROOF}</p>
            <Link
              href={START_HREF}
              className="block w-full py-3 px-4 rounded-xl bg-indigo-600 text-center text-white font-semibold hover:bg-indigo-500 transition-colors"
            >
              Start Free Trial
            </Link>
          </article>

          {/* Enterprise Tier */}
          <article className="bg-gray-900 border border-amber-500/40 rounded-2xl p-6 flex flex-col ring-1 ring-amber-500/10 relative overflow-hidden">
            <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30">
              <span className="text-xs font-medium text-amber-300">Enterprise</span>
            </div>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white">{TIER_CONFIG.enterprise.label}</h3>
              <p className="mt-1 text-xs text-gray-500">Full compliance stack for regulated industries.</p>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">
                  ${isAnnual ? Math.round(TIER_CONFIG.enterprise.annual / 12) : TIER_CONFIG.enterprise.monthly}
                </span>
                <span className="text-sm text-gray-400">/month</span>
              </div>
              {isAnnual ? (
                <p className="mt-1 text-xs text-emerald-400">${TIER_CONFIG.enterprise.annual}/yr billed annually</p>
              ) : (
                <p className="mt-1 text-xs text-emerald-400">
                  or ${TIER_CONFIG.enterprise.annual}/yr &mdash; save ~17%
                </p>
              )}
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              <PricingFeature>Everything in Agency, plus:</PricingFeature>
              <PricingFeature>Unlimited seats &amp; scans</PricingFeature>
              <PricingFeature>HIPAA compliance shield</PricingFeature>
              <PricingFeature>PCI-DSS payment security module</PricingFeature>
              <PricingFeature>ADA / WCAG accessibility compliance</PricingFeature>
              <PricingFeature>SOC 2 security controls shield</PricingFeature>
              <PricingFeature>REST API access for automation</PricingFeature>
              <PricingFeature>Dedicated onboarding support</PricingFeature>
            </ul>
            <p className="mb-4 text-xs text-gray-500 text-center">{ENTERPRISE_SOCIAL_PROOF}</p>
            <Link
              href={START_HREF}
              className="block w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 text-center text-white font-semibold hover:from-amber-500 hover:to-orange-500 transition-all"
            >
              Contact Sales
            </Link>
          </article>
        </div>

        {/* Guarantee */}
        <p className="mt-8 text-center text-xs text-gray-500">
          30-day money-back guarantee on all paid plans. No questions asked.
        </p>
      </div>
    </section>
  );
}
