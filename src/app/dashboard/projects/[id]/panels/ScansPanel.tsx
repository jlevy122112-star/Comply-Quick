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
import type { ScanExportFormat } from "@/lib/workspace/scan-exports";
import { buildCanonicalScanResults, buildScanTimeline, REGULATIONS } from "@/lib/workspace/scan-results";
import { ScoreTrend } from "./ScoreTrend";

function formatScanDate(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

const STATUS_BADGE = {
  completed: { tone: "emerald" as const, label: "Completed" },
  failed: { tone: "rose" as const, label: "Failed" },
};

/** Scans tab — canonical scan results grouped by regulation + timeline history. */
export function ScansPanel({
  scans,
  projectId,
  projectName,
  workspaceName,
}: {
  scans: WorkspaceData["scans"];
  projectId: string;
  projectName: string;
  workspaceName: string | null;
}) {
  const [activeScanId, setActiveScanId] = useState(() => scans[0]?.id ?? "");
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [busyExport, setBusyExport] = useState<ScanExportFormat | null>(null);

  const timeline = useMemo(() => buildScanTimeline(scans), [scans]);
  const trend = useMemo(() => [...scans].reverse().map((s) => s.score ?? 0), [scans]);
  const activeScan = useMemo(
    () => scans.find((scan) => scan.id === activeScanId) ?? scans[0] ?? null,
    [activeScanId, scans]
  );
  const activeResults = useMemo(() => (activeScan ? buildCanonicalScanResults(activeScan) : null), [activeScan]);

  if (!activeScan || !activeResults) {
    return (
      <EmptyState
        icon="📡"
        title="No scan results yet"
        description="Run a scan for this workspace project to generate canonical ADA, GDPR, CCPA, and WCAG compliance results."
      />
    );
  }

  const handleExport = async (format: ScanExportFormat) => {
    setBusyExport(format);
    setExportMessage(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/scans/${activeScan.id}/export?format=${format}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setExportMessage(payload?.error ?? `Could not export ${format.toUpperCase()} report.`);
        return;
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") ?? "";
      const filenameMatch = disposition.match(/filename="([^"]+)"/);
      const filename = filenameMatch?.[1] ?? `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.${format}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      setExportMessage(response.headers.get("x-cq-export-message") ?? `${format.toUpperCase()} report downloaded.`);
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
              <Button
                variant="secondary"
                size="sm"
                loading={busyExport === "pdf"}
                onClick={() => void handleExport("pdf")}
              >
                Export PDF
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={busyExport === "txt"}
                onClick={() => void handleExport("txt")}
              >
                Export TXT
              </Button>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge tone="indigo">Workspace: {workspaceName ?? "Unassigned"}</Badge>
            <Badge tone="gray">Project: {projectName}</Badge>
            <Badge tone={STATUS_BADGE[activeScan.status].tone}>Scan {STATUS_BADGE[activeScan.status].label}</Badge>
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
                        <Badge tone={STATUS_BADGE[item.status].tone}>{STATUS_BADGE[item.status].label}</Badge>
                        {item.score !== null && <Badge tone={toneForScore(item.score)}>Score {item.score}/100</Badge>}
                        <Badge tone="rose">C {item.severityCounts.critical}</Badge>
                        <Badge tone="amber">W {item.severityCounts.warning}</Badge>
                        <Badge tone="sky">I {item.severityCounts.info}</Badge>
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
