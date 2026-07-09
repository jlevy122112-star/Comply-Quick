import Link from "next/link";
import {
  Card,
  CardHeader,
  CardBody,
  Badge,
  Button,
  ScoreRing,
  SeverityPill,
  ProgressBar,
  toneForScore,
  TabNav,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  EmptyState,
  ActivityFeed,
  type TabItem,
} from "@/components/ui";
import type { Tier } from "@/lib/pricing";
import type { WorkspaceData } from "@/lib/workspace/data";
import { ApprovalActions } from "./ApprovalActions";
import { TasksPanel } from "./TasksPanel";
import { TeamPanel } from "./TeamPanel";
import { DomainsPanel } from "./DomainsPanel";
import { PolicyRegenerate } from "./PolicyRegenerate";

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

const STATUS_TONE = {
  current: { tone: "emerald" as const, label: "Current" },
  outdated: { tone: "amber" as const, label: "Outdated" },
  action_needed: { tone: "rose" as const, label: "Action needed" },
};

function humanize(value: string): string {
  return value.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const status = STATUS_TONE[project.status];
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
        {/* Breadcrumb */}
        <nav className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <Link href="/dashboard/home" className="hover:text-gray-300">
            Command Center
          </Link>
          <span aria-hidden>/</span>
          <span className="text-gray-300">Workspace</span>
        </nav>

        {/* Header */}
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <ScoreRing score={project.complianceScore.overall} size="lg" label="overall" />
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

        {/* Tabs */}
        <div className="mt-8">
          <TabNav items={tabs} active={activeTab} basePath={basePath} />
        </div>

        {/* Panels */}
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

function ScoreBreakdown({ score }: { score: WorkspaceData["project"]["complianceScore"] }) {
  const rows: { label: string; value: number }[] = [
    { label: "Contract protection", value: score.contractProtection },
    { label: "Privacy coverage", value: score.privacyCoverage },
    { label: "Pre-launch readiness", value: score.preLaunchReadiness },
    { label: "Regulatory breadth", value: score.regulatoryBreadth },
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

function OverviewPanel({ data, basePath }: { data: WorkspaceData; basePath: string }) {
  const { project, findings, pendingCount, regulatoryImpact } = data;
  const criticalCount = findings.filter((f) => f.severity === "critical").length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {regulatoryImpact.actionNeeded && (
        <div className="lg:col-span-3 flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="text-lg" aria-hidden>
              ⚠️
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Regulatory exposure: −{regulatoryImpact.penalty} points
              </p>
              <p className="mt-0.5 text-xs text-amber-200/80">
                {regulatoryImpact.pendingCount} unapproved regulatory change
                {regulatoryImpact.pendingCount !== 1 ? "s" : ""} lowered this project&apos;s effective score to{" "}
                {regulatoryImpact.adjustedScore}/100. Approve the proposed fixes to restore it.
              </p>
            </div>
          </div>
          <Link href={`${basePath}?tab=approvals`} className="shrink-0">
            <Button size="sm">Review fixes</Button>
          </Link>
        </div>
      )}
      <Card className="lg:col-span-2">
        <CardHeader
          title="Compliance score breakdown"
          description="How this project scores across the four risk categories."
        />
        <CardBody>
          <ScoreBreakdown score={project.complianceScore} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="At a glance" />
        <CardBody className="space-y-4">
          <StatRow label="Open findings" value={String(findings.length)} tone={findings.length ? "amber" : "emerald"} />
          <StatRow label="Critical" value={String(criticalCount)} tone={criticalCount ? "rose" : "emerald"} />
          <StatRow label="Pending approvals" value={String(pendingCount)} tone={pendingCount ? "amber" : "emerald"} />
          <div className="pt-2">
            <Link
              href={`${basePath}?tab=findings`}
              className="text-sm font-medium text-indigo-400 hover:text-indigo-300"
            >
              View all findings →
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader
          title="Top priorities"
          description="The lowest-scoring areas — resolve these first to raise your score fastest."
        />
        <CardBody>
          {findings.length === 0 ? (
            <EmptyState
              icon="🎉"
              title="No open findings"
              description="This project meets the target across all categories."
            />
          ) : (
            <ul className="space-y-3">
              {findings.slice(0, 3).map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-4 rounded-lg border border-gray-800 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <SeverityPill severity={f.severity} />
                      <span className="text-sm font-medium text-white">{f.title}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">{f.detail}</p>
                  </div>
                  <span className="shrink-0 text-sm tabular-nums text-gray-500">{f.score}/100</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-400">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}

function FindingsPanel({ findings }: { findings: WorkspaceData["findings"] }) {
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

function ScoreTrend({ scores }: { scores: number[] }) {
  // Oldest → newest sparkline of scan scores. SVG polyline over a 0–100 range.
  if (scores.length < 2) return null;
  const w = 240;
  const h = 48;
  const max = 100;
  const step = w / (scores.length - 1);
  const points = scores.map((s, i) => `${(i * step).toFixed(1)},${(h - (s / max) * h).toFixed(1)}`).join(" ");
  const last = scores[scores.length - 1];
  const first = scores[0];
  const delta = last - first;
  return (
    <div className="flex items-center gap-4">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible" aria-hidden>
        <polyline
          points={points}
          fill="none"
          stroke={delta >= 0 ? "rgb(16 185 129)" : "rgb(244 63 94)"}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="text-sm">
        <span className="tabular-nums font-semibold text-white">{last}</span>
        <span className="text-gray-500">/100</span>
        <span className={`ml-2 tabular-nums ${delta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}
        </span>
      </div>
    </div>
  );
}

function ScansPanel({ scans }: { scans: WorkspaceData["scans"] }) {
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
            <TH>Tools</TH>
            <TH className="text-right">Score</TH>
          </TR>
        </THead>
        <TBody>
          {scans.map((s) => (
            <TR key={s.id}>
              <TD className="tabular-nums text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</TD>
              <TD className="max-w-xs truncate text-white">{s.url}</TD>
              <TD className="tabular-nums text-gray-400">{s.detectedTools.length}</TD>
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

function CoveragePanel({ coverage, tier }: { coverage: WorkspaceData["coverage"]; tier: Tier }) {
  const enabled = coverage.filter((c) => c.enabled).length;
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        {enabled} of {coverage.length} compliance modules enabled for this project.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {coverage.map((c) => (
          <Card key={c.module} className={c.enabled ? "" : "opacity-80"}>
            <CardBody className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="text-xl" aria-hidden>
                  {c.icon}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{c.label}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{c.description}</p>
                </div>
              </div>
              {c.enabled ? (
                <Badge tone="emerald">Enabled</Badge>
              ) : tier === "free" ? (
                <Badge tone="gray">Locked</Badge>
              ) : (
                <Badge tone="gray">Off</Badge>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PoliciesPanel({ data }: { data: WorkspaceData }) {
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

function ApprovalsPanel({ proposals }: { proposals: WorkspaceData["proposals"] }) {
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

function ActivityPanel({ activity }: { activity: WorkspaceData["activity"] }) {
  if (activity.length === 0) {
    return <EmptyState icon="🕑" title="No activity yet" description="Project events will be recorded here." />;
  }
  return (
    <Card>
      <CardBody>
        <ActivityFeed items={activity} />
      </CardBody>
    </Card>
  );
}
