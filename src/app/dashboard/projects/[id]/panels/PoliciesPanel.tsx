import { Card, CardHeader, CardBody, Badge, EmptyState, Table, THead, TBody, TR, TH, TD } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";
import { PolicyRegenerate } from "../PolicyRegenerate";

/** Policies tab — active package preview + accepted-version history. */
export function PoliciesPanel({ data }: { data: WorkspaceData }) {
  const { project, proposals } = data;
  const accepted = proposals.filter((p) => p.status === "accepted");
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Current policy package"
          description="The active compliance package generated for this project."
          actions={
            <div className="flex items-center gap-2">
              <PolicyRegenerate projectId={project.id} />
              <Badge tone="emerald">Live</Badge>
            </div>
          }
        />
        <CardBody>
          {project.packageMarkdown ? (
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-4 text-xs text-gray-300">
              {project.packageMarkdown.slice(0, 4000)}
              {project.packageMarkdown.length > 4000 ? "\n…" : ""}
            </pre>
          ) : (
            <EmptyState
              title="No package stored"
              description="Generate a compliance package to populate this project."
            />
          )}
        </CardBody>
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-300">Version history</h3>
        {accepted.length === 0 ? (
          <EmptyState
            icon="📄"
            title="No accepted updates yet"
            description="Accepted regulatory updates will appear here as new policy versions."
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Summary</TH>
                <TH>Applied</TH>
              </TR>
            </THead>
            <TBody>
              {accepted.map((p) => (
                <TR key={p.id}>
                  <TD className="text-white">{p.summary || "Regulatory update"}</TD>
                  <TD>{new Date(p.resolvedAt ?? p.createdAt).toLocaleDateString()}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}
