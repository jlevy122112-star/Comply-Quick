"use client";

import Link from "next/link";
import { Badge, ProgressBar } from "@/components/ui";
import { ARTIFACT_VALUES, formatUsd, type ArtifactKind } from "@/lib/roi/value";

/** Value line shown on a generated artifact: attorney-equivalent dollars saved. */
export function ValueBanner({ kind }: { kind: ArtifactKind }) {
  const v = ARTIFACT_VALUES[kind];
  return (
    <div className="flex items-center gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">
      <span className="text-lg" aria-hidden="true">
        💸
      </span>
      <p className="text-sm text-emerald-200">
        You just saved <span className="font-semibold text-emerald-300">{formatUsd(v.attorneyCost)}</span> in legal
        fees.{" "}
        <span className="text-emerald-300/70">
          Attorney range {formatUsd(v.range[0])}–{formatUsd(v.range[1])}. {v.basis}
        </span>
      </p>
    </div>
  );
}

/** Guided next-best-action card so users always know the next step. */
export function NextStepCard({
  title,
  description,
  href,
  cta,
}: {
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-indigo-500/25 bg-indigo-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <Badge tone="indigo">Next Step</Badge>
          <p className="text-sm font-semibold text-white">{title}</p>
        </div>
        <p className="mt-1 text-sm text-indigo-200/80">{description}</p>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
      >
        {cta} &rarr;
      </Link>
    </div>
  );
}

/** Stepped progress indicator shown while an artifact is being generated. */
export function GenerateProgress({ steps, activeStep }: { steps: string[]; activeStep: number }) {
  const pct = steps.length === 0 ? 0 : Math.round(((activeStep + 1) / steps.length) * 100);
  return (
    <div className="space-y-2">
      <ProgressBar
        value={pct}
        tone="indigo"
        label={steps[Math.min(activeStep, steps.length - 1)] ?? "Working…"}
        showValue
      />
    </div>
  );
}
