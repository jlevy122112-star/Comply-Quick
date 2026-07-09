"use client";

import { useState, useCallback, useMemo, useTransition } from "react";
import Link from "next/link";
import type { DbProject } from "@/lib/projects-db";
import type { ComplianceScore } from "@/components/ClauseEngine";
import type { Tier } from "@/lib/entitlements";
import { getTierConfig } from "@/lib/pricing";
import { deleteProjectAction, signOutAction } from "@/app/dashboard/actions";
import CommandCenterInsights from "./CommandCenterInsights";
import AutopilotPanel from "./AutopilotPanel";
import ScannerPanel from "./ScannerPanel";
import IntelligencePanel from "./IntelligencePanel";
import NpsSurvey from "./NpsSurvey";
import { alertsForRegions, regionsFromProjects, type RegulatoryAlert } from "@/lib/regulations/alerts";
import type { QuickToolKey } from "@/lib/tools/usage";

// ─── Framework Display Map ──────────────────────────────────────────────────

const FRAMEWORK_LABELS: Record<string, { icon: string; label: string }> = {
  shopify: { icon: "🛒", label: "Shopify" },
  nextjs: { icon: "▲", label: "Next.js" },
  wordpress: { icon: "📝", label: "WordPress" },
  wix: { icon: "🌐", label: "Wix" },
  squarespace: { icon: "◼", label: "Squarespace" },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  current: { bg: "bg-emerald-500/10", text: "text-emerald-400", label: "Current" },
  outdated: { bg: "bg-yellow-500/10", text: "text-yellow-400", label: "Outdated" },
  action_needed: { bg: "bg-red-500/10", text: "text-red-400", label: "Action Needed" },
};

// ─── Regulatory Alerts ──────────────────────────────────────────────────────

const ALERT_SEVERITY_STYLES: Record<string, { border: string; icon: string }> = {
  info: { border: "border-sky-500/30", icon: "ℹ️" },
  warning: { border: "border-yellow-500/30", icon: "⚠️" },
  critical: { border: "border-red-500/30", icon: "🚨" },
};

// ─── Quick Launch Tools ─────────────────────────────────────────────────────

interface QuickTool {
  label: string;
  description: string;
  icon: string;
  href: string;
  available: boolean;
}

const QUICK_TOOLS: QuickTool[] = [
  {
    label: "Generate New Package",
    description: "Run the compliance wizard",
    icon: "🚀",
    href: "/dashboard",
    available: true,
  },
  {
    label: "Cookie Consent Banner",
    description: "Generate consent banner code",
    icon: "🍪",
    href: "/dashboard/tools/cookie-banner",
    available: true,
  },
  {
    label: "DPA Template Builder",
    description: "Data processing agreements",
    icon: "📄",
    href: "/dashboard/tools/dpa",
    available: true,
  },
  {
    label: "Subprocessor Mapping",
    description: "Map vendor data flows",
    icon: "🔗",
    href: "/dashboard/tools/subprocessors",
    available: true,
  },
  {
    label: "Compliance Assistant",
    description: "Ask the AI compliance guide",
    icon: "💬",
    href: "/dashboard/assistant",
    available: true,
  },
  {
    label: "URL Compliance Scanner",
    description: "Auto-detect stack & issues",
    icon: "🔍",
    href: "#scanner",
    available: true,
  },
  {
    label: "Developer API",
    description: "Keys, usage & docs",
    icon: "⚡",
    href: "/dashboard/api",
    available: true,
  },
];

// ─── Main Command Center View ───────────────────────────────────────────────

interface CommandCenterViewProps {
  projects: DbProject[];
  tier: Tier;
  aggregateScore: ComplianceScore | null;
  completedTools: QuickToolKey[];
  userEmail: string | null;
  isLegalAdmin?: boolean;
}

export default function CommandCenterView({
  projects,
  tier,
  aggregateScore,
  completedTools,
  userEmail,
  isLegalAdmin,
}: CommandCenterViewProps) {
  const [isPending, startTransition] = useTransition();
  const [portalLoading, setPortalLoading] = useState(false);
  const projectsNeedingAttention = projects.filter((p) => p.status !== "current").length;
  // Only surface regulatory alerts that touch the jurisdictions this account targets.
  const alerts = useMemo(() => alertsForRegions(regionsFromProjects(projects)), [projects]);

  const handleDeleteProject = useCallback((id: string) => {
    startTransition(() => {
      void deleteProjectAction(id);
    });
  }, []);

  function handleDownload(project: DbProject) {
    const blob = new Blob([project.packageMarkdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, "-")}-compliance.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleManageBilling = useCallback(async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing-portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPortalLoading(false);
      }
    } catch {
      setPortalLoading(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <NpsSurvey />
      {/* Header */}
      <header className="border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs font-medium text-indigo-300">
              Command Center
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                tier === "enterprise"
                  ? "bg-amber-500/20 border border-amber-500/30 text-amber-300"
                  : tier === "agency"
                    ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300"
                    : tier === "solo"
                      ? "bg-gray-700 text-gray-300"
                      : "bg-gray-800 text-gray-400"
              }`}
            >
              {getTierConfig(tier).label}
            </span>
            {(tier === "agency" || tier === "enterprise") && (
              <>
                <Link
                  href="/dashboard/agency"
                  className="hidden sm:inline-block px-3 py-2 rounded-lg border border-indigo-500/40 text-indigo-300 text-sm font-medium hover:border-indigo-400 hover:text-indigo-200 transition-colors"
                >
                  Agency Portal
                </Link>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="hidden sm:inline-block px-3 py-2 rounded-lg border border-gray-700 text-gray-300 text-sm font-medium hover:border-gray-600 hover:text-white transition-colors disabled:opacity-40"
                >
                  {portalLoading ? "Opening…" : "Manage Billing"}
                </button>
                <Link
                  href="/dashboard/cancel"
                  className="hidden sm:inline-block px-3 py-2 rounded-lg text-gray-500 text-sm hover:text-gray-300 transition-colors"
                >
                  Cancel plan
                </Link>
              </>
            )}
            <Link
              href="/dashboard/marketplace"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:border-emerald-400 hover:text-emerald-200 transition-colors"
            >
              Marketplace
            </Link>
            <Link
              href="/dashboard/partners"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:border-emerald-400 hover:text-emerald-200 transition-colors"
            >
              Partners
            </Link>
            <Link
              href="/dashboard/findings"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-rose-500/40 text-rose-300 text-sm font-medium hover:border-rose-400 hover:text-rose-200 transition-colors"
            >
              Findings
            </Link>
            <Link
              href="/dashboard/calendar"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-sky-500/40 text-sky-300 text-sm font-medium hover:border-sky-400 hover:text-sky-200 transition-colors"
            >
              Calendar
            </Link>
            <Link
              href="/dashboard/evidence"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-emerald-500/40 text-emerald-300 text-sm font-medium hover:border-emerald-400 hover:text-emerald-200 transition-colors"
            >
              Evidence
            </Link>
            <Link
              href="/dashboard/alerts"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-sm font-medium hover:border-amber-400 hover:text-amber-200 transition-colors"
            >
              Alerts
            </Link>
            <Link
              href="/dashboard/audit"
              className="hidden sm:inline-block px-3 py-2 rounded-lg border border-gray-600/50 text-gray-300 text-sm font-medium hover:border-gray-400 hover:text-gray-100 transition-colors"
            >
              Audit Trail
            </Link>
            {isLegalAdmin && (
              <Link
                href="/dashboard/legal-review"
                className="hidden sm:inline-block px-3 py-2 rounded-lg border border-amber-500/40 text-amber-300 text-sm font-medium hover:border-amber-400 hover:text-amber-200 transition-colors"
              >
                Legal Review
              </Link>
            )}
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              + New Package
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                title={userEmail ?? undefined}
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Guided Next-Best-Action + ROI + Coverage ── */}
        <CommandCenterInsights
          projects={projects}
          tier={tier}
          aggregateScore={aggregateScore}
          completedTools={completedTools}
        />

        {/* ── Score Overview ── */}
        {aggregateScore ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <ScoreCard label="Overall Score" score={aggregateScore.overall} large />
            <ScoreCard label="Contract Protection" score={aggregateScore.contractProtection} />
            <ScoreCard label="Privacy Coverage" score={aggregateScore.privacyCoverage} />
            <ScoreCard label="Pre-Launch Ready" score={aggregateScore.preLaunchReadiness} />
            <ScoreCard label="Regulatory Breadth" score={aggregateScore.regulatoryBreadth} />
          </section>
        ) : (
          <section className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-2xl mb-2">📊</p>
            <h2 className="text-lg font-semibold text-white mb-2">No projects yet</h2>
            <p className="text-sm text-gray-400 mb-4">
              Generate your first compliance package to see your score overview.
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              Generate Your First Package
            </Link>
          </section>
        )}

        {/* ── Attention Banner ── */}
        {projectsNeedingAttention > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <p className="text-sm text-yellow-300">
              <strong>
                {projectsNeedingAttention} project{projectsNeedingAttention > 1 ? "s" : ""}
              </strong>{" "}
              need attention — regulations may have updated since last generation.
            </p>
          </div>
        )}

        {/* ── Two-Column Layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Projects + Documents */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Projects */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Active Projects</h2>
                <span className="text-xs text-gray-500">
                  {projects.length} project{projects.length !== 1 ? "s" : ""}
                </span>
              </div>
              {projects.length > 0 ? (
                <div className={`space-y-3 ${isPending ? "opacity-60" : ""}`}>
                  {projects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onDelete={handleDeleteProject}
                      onDownload={handleDownload}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-800 border-dashed rounded-xl p-6 text-center">
                  <p className="text-sm text-gray-500">
                    No projects saved yet. Generate a compliance package to add your first project.
                  </p>
                </div>
              )}
            </section>

            {/* Compliance Scanner */}
            <div id="scanner" className="scroll-mt-8">
              <ScannerPanel tier={tier} />
            </div>

            {/* Compliance Intelligence — proactive monitoring + alerts */}
            <IntelligencePanel isPremium={tier !== "free"} />

            {/* Quick-Launch Tools */}
            <section>
              <h2 className="text-lg font-semibold text-white mb-4">Quick-Launch Tools</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {QUICK_TOOLS.map((tool) => (
                  <QuickToolCard key={tool.label} tool={tool} />
                ))}
              </div>
            </section>
          </div>

          {/* Right: Alerts Feed */}
          <div className="space-y-8">
            <AutopilotPanel isPremium={tier !== "free"} />
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Regulatory Alerts</h2>
                {tier !== "enterprise" && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
                    Enterprise
                  </span>
                )}
              </div>
              {tier === "enterprise" ? (
                alerts.length > 0 ? (
                  <div className="space-y-3">
                    {alerts.map((alert) => (
                      <AlertCard key={alert.id} alert={alert} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
                    <p className="text-sm text-gray-400">
                      No open regulatory changes for your targeted jurisdictions. We&apos;ll alert you here when
                      something shifts.
                    </p>
                  </div>
                )
              ) : (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="space-y-3 blur-sm opacity-60 select-none pointer-events-none">
                    {[0, 1].map((i) => (
                      <div key={i} className="p-3 bg-gray-800/50 rounded-lg">
                        <div className="h-3 bg-gray-700 rounded w-3/4 mb-2" />
                        <div className="h-2 bg-gray-700/50 rounded w-full mb-1" />
                        <div className="h-2 bg-gray-700/50 rounded w-2/3" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-center">
                    <p className="text-xs text-gray-400 mb-2">
                      Regulatory alerts are available on the Enterprise plan.
                    </p>
                    <Link
                      href="/#pricing"
                      className="text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      Upgrade to Enterprise &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </section>

            {/* API Access Card */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⚡</span>
                <h3 className="text-sm font-semibold text-white">API Access</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Generate compliance packages programmatically via the REST API.
              </p>
              <code className="block text-xs text-indigo-400 bg-gray-800/50 rounded-lg p-3 mb-3 overflow-x-auto">
                POST /api/v1/compliance
              </code>
              <Link
                href="/dashboard/api"
                className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Manage keys & docs &rarr;
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function ScoreCard({ label, score, large }: { label: string; score: number; large?: boolean }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : "text-red-400";
  const bgColor = score >= 80 ? "bg-emerald-500/10" : score >= 60 ? "bg-yellow-500/10" : "bg-red-500/10";

  return (
    <div className={`${bgColor} border border-gray-800 rounded-xl p-4 ${large ? "sm:col-span-2 lg:col-span-1" : ""}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`${large ? "text-3xl" : "text-2xl"} font-bold ${color}`}>{score}</p>
      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            score >= 80 ? "bg-emerald-400" : score >= 60 ? "bg-yellow-400" : "bg-red-400"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
  onDownload,
}: {
  project: DbProject;
  onDelete: (id: string) => void;
  onDownload: (project: DbProject) => void;
}) {
  const fw = FRAMEWORK_LABELS[project.framework] ?? { icon: "📦", label: project.framework };
  const statusStyle = STATUS_STYLES[project.status] ?? STATUS_STYLES.current;
  const scoreColor =
    project.complianceScore.overall >= 80
      ? "text-emerald-400"
      : project.complianceScore.overall >= 60
        ? "text-yellow-400"
        : "text-red-400";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl shrink-0">{fw.icon}</span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">{project.name}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {fw.label} &middot; {project.trackingPixels.length} pixel
              {project.trackingPixels.length !== 1 ? "s" : ""} &middot; {project.targetRegions.length} region
              {project.targetRegions.length !== 1 ? "s" : ""}
              {project.complianceModules.length > 0 &&
                ` · ${project.complianceModules.length} module${project.complianceModules.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-lg font-bold ${scoreColor}`}>{project.complianceScore.overall}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800">
        <span className="text-xs text-gray-500">Generated {new Date(project.createdAt).toLocaleDateString()}</span>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/projects/${project.id}`}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            Open workspace →
          </Link>
          <button
            type="button"
            onClick={() => onDownload(project)}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Download
          </button>
          <button
            type="button"
            onClick={() => onDelete(project.id)}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickToolCard({ tool }: { tool: QuickTool }) {
  const content = (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-xl p-4 transition-all ${
        tool.available ? "hover:border-gray-600 hover:scale-[1.02] cursor-pointer" : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{tool.icon}</span>
        <div>
          <h3 className="text-sm font-medium text-white">{tool.label}</h3>
          <p className="text-xs text-gray-500">{tool.description}</p>
        </div>
      </div>
      {!tool.available && (
        <span className="mt-2 inline-block px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400">
          Coming Soon
        </span>
      )}
    </div>
  );

  if (tool.available) {
    return <Link href={tool.href}>{content}</Link>;
  }
  return content;
}

function AlertCard({ alert }: { alert: RegulatoryAlert }) {
  const style = ALERT_SEVERITY_STYLES[alert.severity] ?? ALERT_SEVERITY_STYLES.info;
  return (
    <div className={`bg-gray-900 border ${style.border} rounded-xl p-4`}>
      <div className="flex items-start gap-2">
        <span className="shrink-0">{style.icon}</span>
        <div>
          <h3 className="text-sm font-medium text-white">{alert.title}</h3>
          <p className="text-xs text-gray-400 mt-1">{alert.description}</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <a
              href={alert.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              {alert.law} — source &rarr;
            </a>
            <span className="shrink-0 text-xs text-gray-500">{alert.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
