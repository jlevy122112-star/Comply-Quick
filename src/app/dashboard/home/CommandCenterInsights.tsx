"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { DbProject } from "@/lib/projects-db";
import type { QuickToolKey } from "@/lib/tools/usage";
import type { ComplianceScore } from "@/components/ClauseEngine";
import type { Tier } from "@/lib/entitlements";
import { Badge, Card, CardBody, CardHeader, ProgressBar, UpsellCta } from "@/components/ui";
import { computeRoi, formatUsd } from "@/lib/roi/value";

interface OnboardingStep {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

const MAJOR_REGIMES = ["eu_gdpr", "california_ccpa"];

function buildSteps(projects: DbProject[], completedTools: QuickToolKey[]): OnboardingStep[] {
  const hasProject = projects.length > 0;
  const coversRegime = projects.some((p) => p.targetRegions.some((r) => MAJOR_REGIMES.includes(r)));
  const used = new Set(completedTools);
  return [
    { key: "package", label: "Generate Your First Compliance Package", href: "/dashboard", done: hasProject },
    { key: "regime", label: "Cover a GDPR or CCPA Jurisdiction", href: "/dashboard", done: coversRegime },
    {
      key: "banner",
      label: "Add a Cookie Consent Banner",
      href: "/dashboard/tools/cookie-banner",
      done: used.has("cookie_banner"),
    },
    { key: "dpa", label: "Generate a DPA for Your Vendors", href: "/dashboard/tools/dpa", done: used.has("dpa") },
    {
      key: "subs",
      label: "Map Your Subprocessors",
      href: "/dashboard/tools/subprocessors",
      done: used.has("subprocessors"),
    },
  ];
}

export default function CommandCenterInsights({
  projects,
  tier,
  aggregateScore,
  completedTools,
  showNextAction = true,
}: {
  projects: DbProject[];
  tier: Tier;
  aggregateScore: ComplianceScore | null;
  completedTools: QuickToolKey[];
  showNextAction?: boolean;
}) {
  const steps = useMemo(() => buildSteps(projects, completedTools), [projects, completedTools]);
  const doneCount = steps.filter((s) => s.done).length;
  const onboardingPct = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.done) ?? null;

  const coverage = aggregateScore?.overall ?? 0;

  // Headline is the gross attorney-equivalent value of what the user generated
  // ("legal fees avoided"). We intentionally do NOT net out subscription cost or
  // show a return multiple: we don't track subscription tenure or billing cadence,
  // so any net/ROI-multiple figure would mismatch the lifetime-cumulative value.
  const roi = useMemo(() => computeRoi({ compliance_package: projects.length }), [projects.length]);

  return (
    <section className={`grid grid-cols-1 gap-4 ${showNextAction ? "lg:grid-cols-3" : ""}`}>
      {showNextAction && (
        <Card className="lg:col-span-2">
          <CardHeader
            title="Your Next Step"
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
      )}

      {/* ROI + coverage + upsell */}
      <div className="space-y-4">
        <Card>
          <CardHeader title="Value delivered" icon="💸" />
          <CardBody className="space-y-3">
            {roi.grossSaved > 0 ? (
              <>
                <p className="text-3xl font-bold text-emerald-400">{formatUsd(roi.grossSaved)}</p>
                <p className="text-xs text-gray-400">
                  Legal fees avoided across {projects.length} generated package
                  {projects.length !== 1 ? "s" : ""} vs. commissioning counsel.
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-white">Start saving</p>
                <p className="text-xs text-gray-400">
                  Your value tracking will appear here once your compliance workspace is active.
                </p>
              </>
            )}
            <div>
              <ProgressBar value={coverage} label="Compliance coverage" showValue />
            </div>
          </CardBody>
        </Card>

        <UpsellCta tier={tier} />
      </div>
    </section>
  );
}
