"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DbProject } from "@/lib/projects-db";
import type { ComplianceScore } from "@/components/ClauseEngine";
import type { Tier } from "@/lib/entitlements";
import { getTierConfig } from "@/lib/pricing";
import { Badge, Card, CardBody, CardHeader, ProgressBar } from "@/components/ui";
import { ARTIFACT_VALUES, computeRoi, formatUsd } from "@/lib/roi/value";

interface OnboardingStep {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

const MAJOR_REGIMES = ["eu_gdpr", "california_ccpa"];

function buildSteps(projects: DbProject[]): OnboardingStep[] {
  const hasProject = projects.length > 0;
  const coversRegime = projects.some((p) => p.targetRegions.some((r) => MAJOR_REGIMES.includes(r)));
  return [
    { key: "package", label: "Generate your first compliance package", href: "/dashboard", done: hasProject },
    { key: "regime", label: "Cover a GDPR or CCPA jurisdiction", href: "/dashboard", done: coversRegime },
    { key: "banner", label: "Add a cookie consent banner", href: "/dashboard/tools/cookie-banner", done: false },
    { key: "dpa", label: "Generate a DPA for your vendors", href: "/dashboard/tools/dpa", done: false },
    { key: "subs", label: "Map your subprocessors", href: "/dashboard/tools/subprocessors", done: false },
  ];
}

export default function CommandCenterInsights({
  projects,
  tier,
  aggregateScore,
}: {
  projects: DbProject[];
  tier: Tier;
  aggregateScore: ComplianceScore | null;
}) {
  const steps = useMemo(() => buildSteps(projects), [projects]);
  const doneCount = steps.filter((s) => s.done).length;
  const onboardingPct = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.done) ?? null;

  const coverage = aggregateScore?.overall ?? 0;

  // Net the subscriber's actual annual cost out of the headline so the ROI figure
  // is defensible (net value, not gross) and can show a real return multiple.
  const annualCost = getTierConfig(tier).annual;
  const roi = useMemo(
    () => computeRoi({ compliance_package: projects.length }, annualCost),
    [projects.length, annualCost]
  );

  const upsell = tier === "free" || tier === "solo";
  const nextTier = tier === "free" ? "solo" : "agency";
  const nextTierCfg = getTierConfig(nextTier);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Next best action + onboarding progress */}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Your next step"
          description="Complete your compliance setup — you're never left guessing."
          icon="🎯"
          actions={<Badge tone="indigo">{onboardingPct}% set up</Badge>}
        />
        <CardBody className="space-y-4">
          <ProgressBar value={onboardingPct} tone="indigo" />
          {nextStep ? (
            <div className="flex flex-col gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{nextStep.label}</p>
                <p className="mt-0.5 text-xs text-indigo-200/80">Recommended next action for your account.</p>
              </div>
              <Link
                href={nextStep.href}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Do it now &rarr;
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
              <p className="text-sm font-semibold text-emerald-200">🎉 You&apos;ve completed the core setup.</p>
              <p className="mt-0.5 text-xs text-emerald-300/70">Keep your packages current as regulations change.</p>
            </div>
          )}
          <ul className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.key} className="flex items-center gap-2 text-sm">
                <span className={s.done ? "text-emerald-400" : "text-gray-600"}>{s.done ? "✓" : "○"}</span>
                <Link
                  href={s.href}
                  className={s.done ? "text-gray-400 line-through" : "text-gray-300 hover:text-white"}
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* ROI + coverage + upsell */}
      <div className="space-y-4">
        <Card>
          <CardHeader title="Value delivered" icon="💸" />
          <CardBody className="space-y-3">
            {roi.grossSaved > 0 ? (
              <>
                <p className="text-3xl font-bold text-emerald-400">{formatUsd(roi.netSaved)}</p>
                <p className="text-xs text-gray-400">
                  Net legal fees saved across {projects.length} generated package
                  {projects.length !== 1 ? "s" : ""} vs. commissioning counsel
                  {annualCost > 0 ? `, after your ${formatUsd(annualCost)}/yr plan` : ""}.
                </p>
                {roi.roiMultiple !== null && (
                  <Badge tone="emerald">{roi.roiMultiple}× return on your subscription</Badge>
                )}
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white">Start saving</p>
                <p className="text-xs text-gray-400">
                  Generate your first package to save ~{formatUsd(ARTIFACT_VALUES.compliance_package.attorneyCost)} in
                  legal fees.
                </p>
              </>
            )}
            <div>
              <ProgressBar value={coverage} label="Compliance coverage" showValue />
            </div>
          </CardBody>
        </Card>

        {upsell && (
          <Card>
            <CardBody className="space-y-2">
              <Badge tone="amber">Upgrade</Badge>
              <p className="text-sm font-semibold text-white">Unlock more with {nextTierCfg.label}</p>
              <p className="text-xs text-gray-400">
                {nextTier === "solo"
                  ? "Unlimited generations, 20 scans/mo, and full contract shields."
                  : "Ongoing monitoring, 5 seats, white-label exports and 100 scans/mo."}
              </p>
              <Link
                href="/#pricing"
                className="mt-1 block w-full rounded-lg bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-gray-950 transition-colors hover:bg-amber-400"
              >
                Upgrade to {nextTierCfg.label} — {formatUsd(nextTierCfg.monthly)}/mo
              </Link>
            </CardBody>
          </Card>
        )}
      </div>
    </section>
  );
}
