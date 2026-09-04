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
import { InstallationPanel } from "@/app/dashboard/settings/organization/InstallationPanel";

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
  { key: "settings", label: "Settings", icon: "⚙️" },
] as const;

export type WorkspaceTabKey = (typeof WORKSPACE_TABS)[number]["key"];

export function WorkspaceView({
  data,
  tier,
  activeTab,
  installation,
}: {
  data: WorkspaceData;
  tier: Tier;
  activeTab: WorkspaceTabKey;
  installation: {
    workspace: {
      id: string;
      organizationId: string;
      name: string;
      slug: string;
      projectCount: number;
      createdAt: string;
    };
    keys: {
      id: string;
      name: string;
      keyPrefix: string;
      lastUsedAt: string | null;
      revokedAt: string | null;
      createdAt: string;
    }[];
    canManage: boolean;
  } | null;
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

        <WorkspaceHeader project={project} workspace={data.workspace} pendingCount={pendingCount} basePath={basePath} />

        <div className="mt-8">
          <TabNav items={tabs} active={activeTab} basePath={basePath} />
        </div>

        <div className="mt-6">
          {activeTab === "overview" && <OverviewPanel data={data} basePath={basePath} />}
          {activeTab === "scans" && (
            <ScansPanel
              scans={scans}
              projectId={project.id}
              projectName={project.name}
              workspaceId={project.workspaceId}
              workspaceName={data.workspace?.name ?? null}
            />
          )}
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
          {activeTab === "settings" && installation && (
            <InstallationPanel
              workspaces={[installation.workspace]}
              initialWorkspaceId={installation.workspace.id}
              initialKeys={installation.keys}
              canManage={installation.canManage}
              hideWorkspaceSelector
            />
          )}
          {activeTab === "settings" && !installation && (
            <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6 text-sm text-gray-300">
              This project is not yet attached to a workspace that can issue install snippets.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
