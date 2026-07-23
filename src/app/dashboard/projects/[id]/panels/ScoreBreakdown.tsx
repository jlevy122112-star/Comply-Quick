import { ProgressBar, toneForScore } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";

/** Four-category compliance score breakdown with per-category progress bars. */
export function ScoreBreakdown({ score }: { score: WorkspaceData["project"]["complianceScore"] }) {
  const rows: { label: string; value: number }[] = [
    { label: "Contract Protection", value: score.contractProtection },
    { label: "Privacy Coverage", value: score.privacyCoverage },
    { label: "Pre-Launch Readiness", value: score.preLaunchReadiness },
    { label: "Regulatory Breadth", value: score.regulatoryBreadth },
  ];
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="text-gray-300">{r.label}</span>
            <span className="tabular-nums text-gray-400">{r.value}/100</span>
          </div>
          <ProgressBar value={r.value} tone={toneForScore(r.value)} />
        </div>
      ))}
    </div>
  );
}
