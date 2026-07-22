import Link from "next/link";
import type { ComplianceScore } from "@/components/ClauseEngine";
import type { DbProject } from "@/lib/projects-db";
import type { QuickToolKey } from "@/lib/tools/usage";
import type { ScanUsage } from "@/lib/billing/usage";
import { Card, CardBody, CardHeader, ProgressBar, ScoreRing } from "@/components/ui";
import { selectRecommendation, setupCompletion } from "./recommendation";

function scoreLabel(score: number) {
  if (score >= 80) return "Healthy";
  if (score >= 60) return "Needs attention";
  return "At risk";
}

function scoreTone(score: number) {
  if (score >= 80) return "text-status-success";
  if (score >= 60) return "text-status-warning";
  return "text-status-danger";
}

export default function HeroStatusPanel({
  aggregateScore,
  projects,
  completedTools,
  scanUsage,
}: {
  aggregateScore: ComplianceScore | null;
  projects: DbProject[];
  completedTools: QuickToolKey[];
  scanUsage: ScanUsage | null;
}) {
  const score = aggregateScore?.overall ?? 0;
  const recommendation = selectRecommendation({ aggregateScore, projects, completedTools, scanUsage });
  const setupPct = setupCompletion(projects, completedTools);

  return (
    <section aria-labelledby="compliance-status-title" className="space-y-4">
      <Card variant="elevated" className="overflow-hidden border-accent-primary/20 bg-surface-elevated">
        <CardBody className="p-5 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-center">
            <div className="flex items-center gap-5 sm:gap-7">
              <ScoreRing score={score} size="lg" label="overall score" tone="surface" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Tier 1 · Hero</p>
                <h1 id="compliance-status-title" className="type-h1 mt-2 text-text-primary">
                  Your Compliance Status
                </h1>
                {aggregateScore ? (
                  <p className="mt-2 text-sm text-text-secondary">
                    Overall status: <span className={`font-semibold ${scoreTone(score)}`}>{scoreLabel(score)}</span>
                  </p>
                ) : (
                  <p className="mt-2 max-w-sm text-sm text-text-secondary">
                    Start with a package to establish your organization&apos;s compliance baseline.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border-default bg-surface-card/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent-primary">
                    Recommended next action
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-text-primary">{recommendation.title}</h2>
                </div>
                <span className="rounded-full bg-accent-primary/10 px-2.5 py-1 text-xs font-semibold text-accent-primary">
                  {setupPct}% set up
                </span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">{recommendation.description}</p>
              <div className="mt-4 border-t border-border-default pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">Why this matters</p>
                <p className="mt-1 text-sm leading-6 text-text-secondary">{recommendation.why}</p>
              </div>
              <div className="mt-5">
                {recommendation.href.startsWith("#") ? (
                  <Link
                    href={recommendation.href}
                    className="inline-flex rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-text-inverse shadow-sm transition-all hover:-translate-y-px hover:bg-accent-primary-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
                  >
                    {recommendation.ctaLabel}
                  </Link>
                ) : (
                  <Link
                    href={recommendation.href}
                    className="inline-flex rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-medium text-text-inverse shadow-sm transition-all hover:-translate-y-px hover:bg-accent-primary-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-page-bg"
                  >
                    {recommendation.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2" aria-label="Compliance details">
        <Card variant="glass">
          <CardHeader title="Score detail" description="How your current baseline is tracking." />
          <CardBody className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
            {aggregateScore ? (
              <>
                <ScoreDetail label="Contract" value={aggregateScore.contractProtection} />
                <ScoreDetail label="Privacy" value={aggregateScore.privacyCoverage} />
                <ScoreDetail label="Readiness" value={aggregateScore.preLaunchReadiness} />
                <ScoreDetail label="Regulatory" value={aggregateScore.regulatoryBreadth} />
              </>
            ) : (
              <p className="col-span-full text-sm text-text-muted">Generate a package to see score detail.</p>
            )}
          </CardBody>
        </Card>

        <Card variant="glass">
          <CardHeader title="Scan usage" description="Current calendar-month coverage." />
          <CardBody>
            {scanUsage ? (
              <div className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <p className="text-2xl font-semibold tabular-nums text-text-primary">{scanUsage.used}</p>
                  <p className="text-xs text-text-muted">
                    {scanUsage.limit === Infinity ? "Unlimited included" : `${scanUsage.limit} included this month`}
                  </p>
                </div>
                {scanUsage.limit !== Infinity && (
                  <ProgressBar
                    value={scanUsage.used}
                    max={scanUsage.limit}
                    label="Scans used"
                    showValue
                    asPercent={false}
                  />
                )}
                {scanUsage.over > 0 && (
                  <p className="text-xs font-medium text-status-warning">
                    {scanUsage.over} scan(s) over included usage.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Scan usage is unavailable right now.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

function ScoreDetail({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="font-semibold tabular-nums text-text-primary">{value}</span>
      </div>
      <ProgressBar value={value} className="mt-2" ariaLabel={`${label} score`} />
    </div>
  );
}
