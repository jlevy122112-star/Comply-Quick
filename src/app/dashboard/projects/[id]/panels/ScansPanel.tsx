"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  SeverityPill,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  toneForScore,
} from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";
import { exportScanResults, type ScanExportFormat } from "@/lib/workspace/scan-exports";
import { buildCanonicalScanResults, buildScanTimelineFromResults, REGULATIONS } from "@/lib/workspace/scan-results";
import { ScoreTrend } from "./ScoreTrend";

const SCAN_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

function formatScanDate(value: string): string {
  return `${SCAN_DATE_FORMATTER.format(new Date(value))} UTC`;
}

const STATUS_BADGE = {
  completed: { tone: "emerald" as const, label: "Completed" },
  failed: { tone: "rose" as const, label: "Failed" },
};

function statusBadge(status: string): { tone: "emerald" | "rose" | "gray"; label: string } {
  if (status === "completed" || status === "failed") return STATUS_BADGE[status];
  if (status === "queued") return { tone: "gray", label: "Queued" };
  if (status === "running" || status === "in_progress") return { tone: "gray", label: "In progress" };
  return { tone: "gray", label: "Unknown" };
}

/** Scans tab — canonical scan results grouped by regulation + timeline history. */
export function ScansPanel({
  scans,
  projectId,
  projectName,
  workspaceId,
  workspaceName,
}: {
  scans: WorkspaceData["scans"];
  projectId: string;
  projectName: string;
  workspaceId: string | null;
  workspaceName: string | null;
}) {
  const [activeScanId, setActiveScanId] = useState(() => scans[0]?.id ?? "");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<ScanExportFormat | null>(null);

  const canonicalResults = useMemo(() => scans.map((scan) => buildCanonicalScanResults(scan)), [scans]);
  const timeline = useMemo(() => buildScanTimelineFromResults(canonicalResults), [canonicalResults]);
  const trend = useMemo(() => [...scans].reverse().map((s) => s.score ?? 0), [scans]);
  const activeResults = useMemo(
    () => canonicalResults.find((result) => result.scanId === activeScanId) ?? canonicalResults[0] ?? null,
    [activeScanId, canonicalResults]
  );
  const activeScan = useMemo(
    () => scans.find((scan) => scan.id === activeResults?.scanId) ?? scans[0] ?? null,
    [activeResults, scans]
  );

  if (!activeScan || !activeResults) {
    return (
      <EmptyState
        icon="📡"
        title="No scan results yet"
        description="Run a scan for this workspace project to generate canonical ADA, GDPR, CCPA, and WCAG compliance results."
      />
    );
  }

  const handleExport = (format: ScanExportFormat) => {
    setBusyExport(format);
    try {
      const result = exportScanResults({
        format,
        workspaceId,
        workspaceName,
        projectId,
        projectName,
        generatedAt: new Date().toISOString(),
        timelineItem: timeline.find((item) => item.scanId === activeScan.id) ?? timeline[0],
      });
      setExportMessage(result.message);
    } catch {
      setExportMessage("Export could not be started. Please try again.");
    } finally {
      setBusyExport(null);
    }
  };

  return (
    <div className="space-y-6">
      {trend.length >= 2 && (
        <Card>
          <CardHeader title="Score Trend" description="Compliance score movement over recent scans." />
          <CardBody>
            <ScoreTrend scores={trend} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Canonical Scan Results"
          description="Agency-ready issue triage grouped by regulation for this workspace project."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" loading={busyExport === "pdf"} onClick={() => handleExport("pdf")}>
                Export PDF
              </Button>
              <Button variant="secondary" size="sm" loading={busyExport === "txt"} onClick={() => handleExport("txt")}>
                Export TXT
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="indigo">Workspace: {workspaceName ?? "Unassigned"}</Badge>
            <Badge tone="gray">Project: {projectName}</Badge>
            <Badge tone={statusBadge(activeScan.status).tone}>Scan {statusBadge(activeScan.status).label}</Badge>
            <Badge tone="gray">Target: {activeResults.target}</Badge>
            <Badge tone="gray">Scanned: {formatScanDate(activeScan.createdAt)}</Badge>
            {activeScan.score !== null && (
              <Badge tone={toneForScore(activeScan.score)}>Score: {activeScan.score}/100</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone="rose">Critical: {activeResults.severityCounts.critical}</Badge>
            <Badge tone="amber">Warning: {activeResults.severityCounts.warning}</Badge>
            <Badge tone="sky">Info: {activeResults.severityCounts.info}</Badge>
          </div>

          {exportMessage && (
            <p className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-200">
              {exportMessage}
            </p>
          )}

          {activeScan.status === "failed" && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {activeScan.error ?? "This scan failed before results could be generated."}
            </p>
          )}

          {REGULATIONS.map((regulation) => {
            const issues = activeResults.issuesByRegulation[regulation];
            return (
              <section key={regulation} className="space-y-2" aria-label={`${regulation} regulation section`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">{regulation}</h3>
                  <Badge tone="gray">
                    {issues.length} issue{issues.length === 1 ? "" : "s"}
                  </Badge>
                </div>
                {issues.length === 0 ? (
                  <p className="rounded-lg border border-gray-800 bg-gray-900/40 px-3 py-2 text-xs text-gray-400">
                    No active findings mapped to {regulation} in this scan.
                  </p>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Severity</TH>
                        <TH>Remediation Guidance</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {issues.map((issue) => (
                        <TR key={issue.id}>
                          <TD>
                            <SeverityPill severity={issue.severity} />
                          </TD>
                          <TD>
                            <p className="font-medium text-white">What to fix: {issue.whatToFix}</p>
                            <p className="mt-1 text-xs text-gray-400">Why: {issue.whyItMatters}</p>
                            <p className="mt-1 text-xs text-gray-500">How: {issue.howToFix}</p>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </section>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Scan History Timeline"
          description="Recent scans for this project within the current workspace context."
        />
        <CardBody>
          <ol className="space-y-2">
            {timeline.map((item) => {
              const isActive = item.scanId === activeScan.id;
              return (
                <li key={item.scanId}>
                  <button
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setActiveScanId(item.scanId)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "border-indigo-500/60 bg-indigo-500/10"
                        : "border-gray-800 bg-gray-900/40 hover:border-gray-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-white">{item.target}</p>
                        <p className="text-xs text-gray-400">{formatScanDate(item.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone={statusBadge(item.status).tone}>{statusBadge(item.status).label}</Badge>
                        {item.score !== null && <Badge tone={toneForScore(item.score)}>Score {item.score}/100</Badge>}
                        <Badge tone="rose">Critical {item.severityCounts.critical}</Badge>
                        <Badge tone="amber">Warning {item.severityCounts.warning}</Badge>
                        <Badge tone="sky">Info {item.severityCounts.info}</Badge>
                        <Badge tone="gray">Total {item.totalIssues}</Badge>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </CardBody>
      </Card>
    </div>
  );
}
