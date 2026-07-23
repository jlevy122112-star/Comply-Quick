import Link from "next/link";
import { Activity, ArrowLeft, Bell, FileText, Globe, Monitor, Shield } from "lucide-react";
import { Badge, Card, CardBody, CardHeader, EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { SeverityPill, type Severity } from "@/components/ui/SeverityPill";
import type { ClientDashboard } from "@/lib/agency/client-dashboard";

function severityTone(value: string): Severity {
  if (value === "critical") return "critical";
  if (value === "warning") return "warning";
  return "info";
}

function projectStatusTone(status: string) {
  if (status === "current") return "emerald" as const;
  if (status === "action_needed") return "rose" as const;
  return "amber" as const;
}

function projectStatusLabel(status: string) {
  if (status === "current") return "Current";
  if (status === "outdated") return "Outdated";
  if (status === "action_needed") return "Action needed";
  return status;
}

function documentStatusTone(status: string) {
  if (status === "accepted") return "emerald" as const;
  if (status === "rejected") return "rose" as const;
  if (status === "superseded") return "gray" as const;
  return "amber" as const;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ClientDashboardView({
  dashboard,
  backHref,
  portalLabel,
}: {
  dashboard: ClientDashboard;
  backHref: string;
  portalLabel: string;
}) {
  const { client, monitors, projects, findings, alerts, documents, stats } = dashboard;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              {portalLabel}
            </Link>
            <span className="hidden h-4 w-px bg-gray-700 sm:inline-block" />
            <h1 className="text-lg font-bold text-white">{client.name}</h1>
            <Badge tone={client.status === "active" ? "emerald" : "gray"}>{client.status}</Badge>
          </div>
          {client.websiteUrl && (
            <a
              href={client.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
            >
              <Globe className="h-4 w-4" />
              Website
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardBody className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                <Monitor className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.monitors}</p>
                <p className="text-xs text-gray-500">Monitors</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                <FileText className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.projects}</p>
                <p className="text-xs text-gray-500">Projects</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400">
                <Shield className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.openFindings}</p>
                <p className="text-xs text-gray-500">Open findings</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400">
                <Bell className="h-5 w-5" />
              </span>
              <div>
                <p className="text-2xl font-bold text-white">{stats.openAlerts}</p>
                <p className="text-xs text-gray-500">Open alerts</p>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Monitors */}
          <Card>
            <CardHeader
              icon={<Monitor className="h-5 w-5 text-indigo-400" />}
              title="Monitors"
              description="Tracked URLs and latest scores"
            />
            <CardBody>
              {monitors.length === 0 ? (
                <EmptyState
                  icon="🔍"
                  title="No monitors"
                  description="Add a monitor for this client to track compliance over time."
                />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Label</TH>
                      <TH>Status</TH>
                      <TH>Last score</TH>
                      <TH>Last scan</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {monitors.map((monitor) => (
                      <TR key={monitor.id}>
                        <TD>
                          <div className="font-medium text-white">{monitor.label || monitor.url}</div>
                          <div className="text-xs text-gray-500">{monitor.url}</div>
                        </TD>
                        <TD>
                          <Badge tone={monitor.active ? "emerald" : "gray"}>
                            {monitor.active ? "Active" : "Paused"}
                          </Badge>
                        </TD>
                        <TD>{monitor.lastScore ?? "—"}</TD>
                        <TD>{formatDate(monitor.lastScannedAt)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          {/* Projects / policies */}
          <Card>
            <CardHeader
              icon={<FileText className="h-5 w-5 text-emerald-400" />}
              title="Projects"
              description="Compliance packages and current status"
            />
            <CardBody>
              {projects.length === 0 ? (
                <EmptyState icon="📁" title="No projects" description="Create a compliance project for this client." />
              ) : (
                <Table>
                  <THead>
                    <TR>
                      <TH>Name</TH>
                      <TH>Framework</TH>
                      <TH>Score</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {projects.map((project) => (
                      <TR key={project.id}>
                        <TD className="font-medium text-white">{project.name}</TD>
                        <TD>{project.framework}</TD>
                        <TD>{project.complianceScore ?? "—"}</TD>
                        <TD>
                          <Badge tone={projectStatusTone(project.status)}>{projectStatusLabel(project.status)}</Badge>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Current policies / regulations */}
        <Card>
          <CardHeader
            icon={<Shield className="h-5 w-5 text-sky-400" />}
            title="Current policies & regulations"
            description="Latest compliance package versions tracked for this client"
          />
          <CardBody>
            {documents.length === 0 ? (
              <EmptyState
                icon="📜"
                title="No policy documents"
                description="Autopilot will propose compliance package updates when tracked regulations change."
              />
            ) : (
              <div className="space-y-3">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex flex-col gap-2 rounded-xl border border-gray-800 bg-gray-950 p-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-white">{document.projectName}</span>
                        {document.regulationName && (
                          <Badge tone="indigo" className="truncate">
                            {document.regulationName}
                          </Badge>
                        )}
                        <Badge tone={documentStatusTone(document.status)}>{document.status}</Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{document.summary || "No summary provided."}</p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">Updated {formatDate(document.updatedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Findings */}
          <Card>
            <CardHeader
              icon={<Shield className="h-5 w-5 text-rose-400" />}
              title="Open findings"
              description="Unresolved compliance gaps"
            />
            <CardBody>
              {findings.length === 0 ? (
                <EmptyState icon="🛡️" title="No open findings" description="All tracked findings are resolved." />
              ) : (
                <div className="space-y-3">
                  {findings.map((finding) => (
                    <div key={finding.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityPill severity={severityTone(finding.severity)} />
                        <Badge tone="gray" className="capitalize">
                          {finding.status}
                        </Badge>
                      </div>
                      <h4 className="mt-2 font-medium text-white">{finding.title}</h4>
                      <p className="text-xs text-gray-500">{finding.category}</p>
                      {finding.recommendation && (
                        <p className="mt-2 text-sm text-gray-400">
                          <span className="font-medium text-gray-300">Recommendation:</span> {finding.recommendation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Alerts */}
          <Card>
            <CardHeader
              icon={<Bell className="h-5 w-5 text-amber-400" />}
              title="Alerts"
              description="Recent compliance events for this client"
            />
            <CardBody>
              {alerts.length === 0 ? (
                <EmptyState
                  icon="🔔"
                  title="No alerts"
                  description="No unresolved compliance alerts for this client."
                />
              ) : (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityPill severity={severityTone(alert.severity)} />
                        {!alert.read && <Badge tone="sky">New</Badge>}
                      </div>
                      <h4 className="mt-2 font-medium text-white">{alert.title}</h4>
                      <p className="text-sm text-gray-400">{alert.body}</p>
                      <p className="mt-2 text-xs text-gray-500">{formatDate(alert.createdAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Activity summary */}
        <Card>
          <CardBody className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-medium text-white">Client activity summary</p>
              <p className="text-sm text-gray-400">
                {stats.monitors} monitor{stats.monitors === 1 ? "" : "s"}, {stats.projects} project
                {stats.projects === 1 ? "" : "s"}, {stats.openFindings} open finding
                {stats.openFindings === 1 ? "" : "s"}, and {stats.openAlerts} open alert
                {stats.openAlerts === 1 ? "" : "s"}.
              </p>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
