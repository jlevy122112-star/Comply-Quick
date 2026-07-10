import { SeverityPill, EmptyState, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";

/** Findings tab — full list of open findings for the project. */
export function FindingsPanel({ findings }: { findings: WorkspaceData["findings"] }) {
  if (findings.length === 0) {
    return (
      <EmptyState
        icon="🎉"
        title="No open findings"
        description="Every compliance category for this project is at or above target."
      />
    );
  }
  return (
    <Table>
      <THead>
        <TR>
          <TH>Severity</TH>
          <TH>Finding</TH>
          <TH>Category</TH>
          <TH className="text-right">Score</TH>
        </TR>
      </THead>
      <TBody>
        {findings.map((f) => (
          <TR key={f.id}>
            <TD>
              <SeverityPill severity={f.severity} />
            </TD>
            <TD>
              <span className="font-medium text-white">{f.title}</span>
              <p className="mt-0.5 text-xs text-gray-500">{f.detail}</p>
            </TD>
            <TD>{f.category}</TD>
            <TD className="text-right tabular-nums">{f.score}/100</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
