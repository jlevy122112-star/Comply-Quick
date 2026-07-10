import Link from "next/link";
import { Card, CardHeader, CardBody, Button, SeverityPill, EmptyState } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";
import { ScoreBreakdown } from "./ScoreBreakdown";
import { StatRow } from "./StatRow";

/** Overview tab — score breakdown, at-a-glance stats, top priorities, exposure banner. */
export function OverviewPanel({ data, basePath }: { data: WorkspaceData; basePath: string }) {
  const { project, findings, pendingCount, regulatoryImpact } = data;
  const criticalCount = findings.filter((f) => f.severity === "critical").length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {regulatoryImpact.actionNeeded && (
        <div className="lg:col-span-3 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="text-lg" aria-hidden>
              ⚠️
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Regulatory exposure: −{regulatoryImpact.penalty} points
              </p>
              <p className="mt-0.5 text-xs text-amber-200/80">
                {regulatoryImpact.pendingCount} unapproved regulatory change
                {regulatoryImpact.pendingCount !== 1 ? "s" : ""} lowered this project&apos;s effective score to{" "}
                {regulatoryImpact.adjustedScore}/100. Approve the proposed fixes to restore it.
              </p>
            </div>
          </div>
          <Link href={`${basePath}?tab=approvals`} className="shrink-0">
            <Button size="sm">Review fixes</Button>
          </Link>
        </div>
      )}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Compliance score breakdown"
          description="How this project scores across the four risk categories."
        />
        <CardBody>
          <ScoreBreakdown score={project.complianceScore} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="At a glance" />
        <CardBody className="space-y-4">
          <StatRow label="Open findings" value={String(findings.length)} tone={findings.length ? "amber" : "emerald"} />
          <StatRow label="Critical" value={String(criticalCount)} tone={criticalCount ? "rose" : "emerald"} />
          <StatRow label="Pending approvals" value={String(pendingCount)} tone={pendingCount ? "amber" : "emerald"} />
          <div className="pt-2">
            <Link
              href={`${basePath}?tab=findings`}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              View all findings →
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Top priorities"
          description="The lowest-scoring areas — resolve these first to raise your score fastest."
        />
        <CardBody>
          {findings.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="No open findings"
              description="This project meets the target across all categories."
            />
          ) : (
            <ul className="space-y-3">
              {findings.slice(0, 3).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityPill severity={f.severity} />
                      <span className="text-sm font-medium text-white">{f.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{f.detail}</p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-gray-500">{f.score}/100</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
