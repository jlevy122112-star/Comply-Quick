import Link from "next/link";
import { Badge, Button, ScoreRing } from "@/components/ui";
import type { WorkspaceData } from "@/lib/workspace/data";

const STATUS_TONE = {
  current: { tone: "emerald" as const, label: "Current" },
  outdated: { tone: "amber" as const, label: "Outdated" },
  action_needed: { tone: "rose" as const, label: "Action needed" },
};

function humanize(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Workspace header — score ring, project meta, and primary actions. */
export function WorkspaceHeader({
  project,
  pendingCount,
  basePath,
}: {
  project: WorkspaceData["project"];
  pendingCount: number;
  basePath: string;
}) {
  const status = STATUS_TONE[project.status];
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-5">
        <ScoreRing score={project.complianceScore.overall} size="lg" label="Overall" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-bold">{project.name}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            {humanize(project.framework)} &middot; {project.targetRegions.length} region
            {project.targetRegions.length !== 1 ? "s" : ""} &middot; {project.complianceModules.length} module
            {project.complianceModules.length !== 1 ? "s" : ""}
          </p>
          <p className="mt-0.5 text-xs text-gray-500">
            Created {new Date(project.createdAt).toLocaleDateString()} &middot; Updated{" "}
            {new Date(project.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/dashboard/home#scanner">
          <Button variant="secondary" size="sm">
            Run a scan
          </Button>
        </Link>
        {pendingCount > 0 && (
          <Link href={`${basePath}?tab=approvals`}>
            <Button size="sm">
              Review {pendingCount} proposal{pendingCount !== 1 ? "s" : ""}
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
