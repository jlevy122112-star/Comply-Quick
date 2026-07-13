import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  EmptyState,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  toneForScore,
} from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";
import { ScoreTrend } from "./ScoreTrend";
import { classifyTracker } from "@/lib/scanner/analyzer";

/** Scans tab — score trend sparkline + scan history table. */
export function ScansPanel({ scans }: { scans: WorkspaceData["scans"] }) {
  if (scans.length === 0) {
    return (
      <EmptyState
        icon="📡"
        title="No scans for this project yet"
        description="Run a scan for this project to track its compliance score over time. Findings from each scan are triaged automatically."
      />
    );
  }
  // scans arrive newest-first; trend wants oldest→newest.
  const trend = [...scans].reverse().map((s) => s.score ?? 0);
  return (
    <div className="space-y-6">
      {trend.length >= 2 && (
        <Card>
          <CardHeader title="Score trend" description="Compliance score across this project's scans." />
          <CardBody>
            <ScoreTrend scores={trend} />
          </CardBody>
        </Card>
      )}
      <Table>
        <THead>
          <TR>
            <TH>Scanned</TH>
            <TH>URL</TH>
            <TH>Trackers & classification</TH>
            <TH className="text-right">Score</TH>
          </TR>
        </THead>
        <TBody>
          {scans.map((s) => (
            <TR key={s.id}>
              <TD className="tabular-nums text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</TD>
              <TD className="max-w-xs truncate text-white">{s.url}</TD>
              <TD className="min-w-64">
                {s.detectedTools.length === 0 ? (
                  <span className="text-gray-500">None detected</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {s.detectedTools.map((tool) => {
                      const classification = tool.classification ?? classifyTracker(tool.category);
                      return (
                        <span
                          key={tool.id}
                          title={classification.detail}
                          className={`rounded-full border px-2 py-1 text-xs ${
                            classification.consentRequired
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border-gray-700 bg-gray-900 text-gray-300"
                          }`}
                        >
                          {tool.name} · {classification.consentRequired ? "gate" : classification.label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </TD>
              <TD className="text-right">
                <Badge tone={toneForScore(s.score ?? 0)}>{s.score ?? 0}/100</Badge>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
