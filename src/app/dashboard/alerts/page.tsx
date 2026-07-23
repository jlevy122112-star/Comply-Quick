import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listProjects } from "@/lib/projects-db";
import { alertsForRegions, regionsFromProjects, type AlertSeverity } from "@/lib/regulations/alerts";
import { listOpenImpacts } from "@/lib/regulations/alert-impacts";
import { Badge, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const SEVERITY_TONE: Record<AlertSeverity, "rose" | "amber" | "sky"> = {
  critical: "rose",
  warning: "amber",
  info: "sky",
};

const RISK_TONE = { high: "rose", medium: "amber", low: "sky" } as const;
const RISK_LABEL = { high: "High", medium: "Medium", low: "Low" } as const;
const SEVERITY_LABEL = { critical: "Critical", warning: "Warning", info: "Info" } as const;

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function AlertsCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/alerts");

  const projects = await listProjects();
  const regions = regionsFromProjects(projects);
  const [alerts, impacts] = await Promise.all([Promise.resolve(alertsForRegions(regions)), listOpenImpacts()]);

  const totalPenalty = impacts.reduce((sum, i) => sum + i.scorePenalty, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Alerts Center</h1>
            <p className="mt-1 text-sm text-gray-400">
              Live regulatory developments across the jurisdictions your projects target, plus any open exposure
              weighing on your compliance score.
            </p>
          </div>
          {totalPenalty > 0 && <Badge tone="rose">−{totalPenalty} pts exposure</Badge>}
        </div>

        {/* Open exposure — changes actively lowering the score */}
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Action Needed</h2>
          {impacts.length === 0 ? (
            <EmptyState
              icon="✅"
              title="No open regulatory exposure"
              description="Your projects are up to date with every tracked regulatory change."
            />
          ) : (
            <div className="space-y-2">
              {impacts.map((i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge tone={RISK_TONE[i.riskLevel]}>{RISK_LABEL[i.riskLevel]} Risk</Badge>
                      <span className="truncate text-sm font-medium text-white">
                        {i.regulationName || i.regulationId}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Detected {fmtDate(i.createdAt)} · lowering score by {i.scorePenalty} points until approved.
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/projects/${i.projectId}?tab=approvals`}
                    className="shrink-0 text-sm font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    Review →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Regulatory feed */}
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Regulatory Developments</h2>
          {alerts.length === 0 ? (
            <EmptyState
              icon="📡"
              title="No developments for your regions"
              description="Add a project targeting a jurisdiction and its regulatory changes will surface here."
            />
          ) : (
            <div className="space-y-3">
              {alerts.map((a) => (
                <article key={a.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={SEVERITY_TONE[a.severity]}>{SEVERITY_LABEL[a.severity]}</Badge>
                    <span className="text-xs font-medium text-gray-500">{a.law}</span>
                    <span className="text-xs text-gray-600">· {fmtDate(a.date)}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-white">{a.title}</h3>
                  <p className="mt-1 text-sm text-gray-400">{a.description}</p>
                  <a
                    href={a.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs font-medium text-indigo-400 hover:text-indigo-300"
                  >
                    Official source ↗
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
