import Link from "next/link";
import { TabNav, type TabItem } from "@/components/ui";
import type { Tier } from "@/lib/pricing";
import type { WorkspaceData } from "@/lib/workspace/data";
import { TasksPanel } from "./TasksPanel";
import { TeamPanel } from "./TeamPanel";
import { DomainsPanel } from "./DomainsPanel";
import { WorkspaceHeader } from "./panels/WorkspaceHeader";
import { OverviewPanel } from "./panels/OverviewPanel";
import { ScansPanel } from "./panels/ScansPanel";
import { FindingsPanel } from "./panels/FindingsPanel";
import { CoveragePanel } from "./panels/CoveragePanel";
import { PoliciesPanel } from "./panels/PoliciesPanel";
import { ApprovalsPanel } from "./panels/ApprovalsPanel";
import { ActivityPanel } from "./panels/ActivityPanel";

export const WORKSPACE_TABS = [
  { key: "overview", label: "Overview", icon: "🏠" },
  { key: "scans", label: "Scans", icon: "📡" },
  { key: "findings", label: "Findings", icon: "🔎" },
  { key: "tasks", label: "Tasks", icon: "🗒️" },
  { key: "coverage", label: "Coverage", icon: "🧩" },
  { key: "policies", label: "Policies", icon: "📄" },
  { key: "approvals", label: "Approvals", icon: "✅" },
  { key: "activity", label: "Activity", icon: "🕑" },
  { key: "team", label: "Team", icon: "👥" },
] as const;

export type WorkspaceTabKey = (typeof WORKSPACE_TABS)[number]["key"];

export function WorkspaceView({
  data,
  tier,
  activeTab,
}: {
  data: WorkspaceData;
  tier: Tier;
  activeTab: WorkspaceTabKey;
}) {
  const { project, findings, coverage, activity, proposals, pendingCount, scans, tasks, members, domains } = data;
  const basePath = `/dashboard/projects/${project.id}`;
  const openTaskCount = tasks.filter((t) => t.status !== "done" && t.status !== "dismissed").length;

  const tabs: TabItem[] = WORKSPACE_TABS.map((t) => ({
    key: t.key,
    label: t.label,
    icon: <span aria-hidden>{t.icon}</span>,
    count:
      t.key === "findings"
        ? findings.length
        : t.key === "tasks"
          ? openTaskCount
          : t.key === "scans"
            ? scans.length
            : t.key === "approvals"
              ? pendingCount
              : t.key === "team"
                ? members.length
                : undefined,
  }));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard/home" className="hover:text-gray-300">
            Command Center
          </Link>
          <span aria-hidden>/</span>
          <span className="text-gray-300">Workspace</span>
        </nav>

        <WorkspaceHeader project={project} pendingCount={pendingCount} basePath={basePath} />

        <div className="mt-8">
          <TabNav items={tabs} active={activeTab} basePath={basePath} />
        </div>

        <div className="mt-6">
          {activeTab === "overview" && <OverviewPanel data={data} basePath={basePath} />}
          {activeTab === "scans" && <ScansPanel scans={scans} />}
          {activeTab === "findings" && <FindingsPanel findings={findings} />}
          {activeTab === "tasks" && <TasksPanel projectId={project.id} tasks={tasks} />}
          {activeTab === "coverage" && <CoveragePanel coverage={coverage} tier={tier} />}
          {activeTab === "policies" && <PoliciesPanel data={data} />}
          {activeTab === "approvals" && <ApprovalsPanel proposals={proposals} />}
          {activeTab === "activity" && <ActivityPanel activity={activity} />}
          {activeTab === "team" && (
            <div className="space-y-6">
              <TeamPanel projectId={project.id} members={members} />
              <DomainsPanel projectId={project.id} domains={domains} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
