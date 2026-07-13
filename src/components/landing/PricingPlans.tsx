"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TIER_CONFIG } from "@/lib/pricing";
import {
  defaultBillingForVariant,
  orderedPlansForVariant,
  resolvePricingExperimentVariant,
} from "@/lib/experiments/pricing";
import { trackClientEvent } from "@/lib/funnel/client";

type Billing = "monthly" | "annual";

interface Plan {
  key: "solo" | "agency" | "enterprise";
  blurb: string;
  features: string[];
  cta: string;
  variant: "default" | "popular" | "enterprise";
}

/** Human-facing scan allotment for a tier (handles the unlimited sentinel). */
function scanCopy(limit: number): string {
  return limit === Infinity ? "Unlimited compliance scans" : `${limit} compliance scans / month`;
}

const PLANS: Plan[] = [
  {
    key: "solo",
    blurb: "For freelancers & solo devs. Cancel anytime.",
    features: [
      scanCopy(TIER_CONFIG.solo.scanLimit),
      "Regulation Autopilot + federal/state monitoring — included",
      "Full document package: contract shield, privacy policy & checklist",
      "Compliance score + embeddable trust badge",
      "Marketplace templates + REST API access",
    ],
    cta: "Start Free",
    variant: "default",
  },
  {
    key: "agency",
    blurb: "For agencies — resell compliance as recurring revenue.",
    features: [
      "Everything in Solo, plus:",
      scanCopy(TIER_CONFIG.agency.scanLimit),
      "Unlimited client sites in one dashboard",
      "Agency Liability Shield\u2122 — shift GDPR/ADA liability to the merchant",
      "AI Compliance Agents that scan, draft, monitor & remediate for you",
      "Evidence packs + append-only audit trail",
      `${TIER_CONFIG.agency.seats} team seats with role-based access`,
      "White-label exports + custom client portal domain",
      "Recurring partner commissions",
      "Priority Agency Support",
    ],
    cta: "Start Free Trial",
    variant: "popular",
  },
  {
    key: "enterprise",
    blurb: "Full compliance stack for regulated industries.",
    features: [
      "Everything in Agency, plus:",
      "A dedicated AI compliance agent assigned to your account",
      "Unlimited team seats & scans",
      "SSO (SAML/OIDC) + org & workspace multi-tenancy",
      "HIPAA, PCI-DSS, ADA/WCAG & SOC 2 modules",
      "Dedicated onboarding + priority SLA",
    ],
    cta: "Contact Sales",
    variant: "enterprise",
  },
];

const CARD: Record<Plan["variant"], string> = {
  default: "border-gray-800",
  popular: "border-indigo-500/40 ring-1 ring-indigo-500/10",
  enterprise: "border-amber-500/40 ring-1 ring-amber-500/10",
};

const BUTTON: Record<Plan["variant"], string> = {
  default: "border border-gray-700 text-white hover:border-gray-500 hover:bg-gray-800",
  popular: "bg-indigo-600 text-white hover:bg-indigo-500",
  enterprise: "bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500",
};

export function PricingPlans({ startHref }: { startHref: string }) {
  const variant = useMemo(() => resolvePricingExperimentVariant(), []);
  const [billing, setBilling] = useState<Billing>(() => defaultBillingForVariant(variant, "annual"));
  const ordered = useMemo(() => orderedPlansForVariant(variant, PLANS), [variant]);

  useEffect(() => {
    trackClientEvent("pricing_variant_seen", { surface: "landing_pricing", variant });
  }, [variant]);

  return (
    <>
      <div className="flex items-center justify-center gap-3 mb-10 sm:mb-14">
        <ToggleButton active={billing === "monthly"} onClick={() => setBilling("monthly")}>
          Monthly
        </ToggleButton>
        <ToggleButton active={billing === "annual"} onClick={() => setBilling("annual")}>
          Annual <span className="text-emerald-400">&middot; save ~17%</span>
        </ToggleButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
        {ordered.map((plan) => {
          const cfg = TIER_CONFIG[plan.key];
          const perMonth = billing === "annual" ? Math.round(cfg.annual / 12) : cfg.monthly;
          return (
            <article
              key={plan.key}
              className={`bg-gray-900 border rounded-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden ${CARD[plan.variant]}`}
            >
              {plan.variant === "popular" && (
                <Badge className="bg-indigo-500/20 border-indigo-500/30 text-indigo-300">Most Popular</Badge>
              )}
              {plan.variant === "enterprise" && (
                <Badge className="bg-amber-500/20 border-amber-500/30 text-amber-300">Enterprise</Badge>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white">{cfg.label}</h3>
                <p className="mt-1 text-xs text-gray-300">{plan.blurb}</p>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">${perMonth}</span>
                  <span className="text-sm text-gray-300">/month</span>
                </div>
                <p className="mt-1 text-xs text-emerald-400">
                  {billing === "annual" ? `Billed $${cfg.annual}/yr` : `or $${cfg.annual}/yr — save ~17%`}
                </p>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-200">
                    <span className="shrink-0 mt-0.5 text-indigo-400">&#x2713;</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={startHref}
                className={`block w-full py-3 px-4 rounded-xl text-center font-semibold transition-colors ${BUTTON[plan.variant]}`}
              >
                {plan.cta}
              </Link>
            </article>
          );
        })}
      </div>
    </>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-indigo-600 text-white" : "border border-gray-700 text-gray-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className={`absolute top-4 right-4 px-2.5 py-0.5 rounded-full border ${className}`}>
      <span className="text-xs font-medium">{children}</span>
    </div>
  );
}
