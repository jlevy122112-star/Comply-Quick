import { Card, CardBody, Badge, EmptyState } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";
import { ApprovalActions } from "../ApprovalActions";

/** Approvals tab — pending human-in-the-loop proposals for this project. */
export function ApprovalsPanel({ proposals }: { proposals: WorkspaceData["proposals"] }) {
  const pending = proposals.filter((p) => p.status === "proposed");
  if (pending.length === 0) {
    return (
      <EmptyState
        icon="✅"
        title="Nothing awaiting approval"
        description="When the Autopilot Remediation Agent detects a regulatory change affecting this project, its proposed edit plan will appear here for your approval."
      />
    );
  }
  return (
    <div className="space-y-3">
      {pending.map((p) => (
        <Card key={p.id}>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge tone="amber">Awaiting approval</Badge>
                {p.regulationId && <span className="text-xs text-gray-500">{p.regulationId}</span>}
              </div>
              <p className="mt-1.5 text-sm text-gray-300">{p.summary || "Proposed regulatory update."}</p>
              <p className="mt-0.5 text-xs text-gray-500">Proposed {new Date(p.createdAt).toLocaleDateString()}</p>
            </div>
            <ApprovalActions proposalId={p.id} />
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
