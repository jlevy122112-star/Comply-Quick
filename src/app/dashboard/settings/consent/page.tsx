import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listProjects } from "@/lib/projects-db";
import { listConsentRecords, getConsentSummary, type ConsentAction } from "@/lib/consent/records";

const RECENT_LIMIT = 25;

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<ConsentAction, string> = {
  accept_all: "Accepted all",
  reject_non_essential: "Rejected non-essential",
  custom: "Custom selection",
  withdraw: "Withdrawn",
  do_not_sell: "Do Not Sell / Share",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Explicit locale + UTC so server-rendered timestamps are deterministic
  // regardless of the deployment host's default locale/timezone.
  return d.toLocaleString("en-US", { timeZone: "UTC", timeZoneName: "short" });
}

export default async function ConsentLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/settings/consent");

  const projects = await listProjects();
  const perProject = await Promise.all(
    projects.map(async (p) => {
      const [records, summary] = await Promise.all([listConsentRecords(p.id, RECENT_LIMIT), getConsentSummary(p.id)]);
      return { project: p, records, total: summary.total, summary };
    })
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Consent Records</h1>
          <p className="mt-1 text-sm text-gray-400">
            Proof-of-consent audit trail captured from your sites&apos; cookie banners. Each entry records a
            visitor&apos;s choice, the categories they consented to, and the policy version in force — the evidence you
            keep to demonstrate consent under GDPR Art. 7.
          </p>
        </div>

        {perProject.length === 0 && (
          <p className="rounded-lg border border-gray-800 bg-gray-900/40 p-6 text-sm text-gray-400">
            No projects yet. Generate a cookie banner for a project with recording enabled to start capturing consent
            records.
          </p>
        )}

        <div className="space-y-6">
          {perProject.map(({ project, records, total, summary }) => (
            <section key={project.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">{project.name}</h2>
                <span className="text-xs text-gray-500">{total} recorded</span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {(Object.keys(ACTION_LABELS) as ConsentAction[]).map((a) =>
                  summary.byAction[a] > 0 ? (
                    <span key={a} className="rounded-full border border-gray-700 px-2.5 py-1 text-gray-300">
                      {ACTION_LABELS[a]}: {summary.byAction[a]}
                    </span>
                  ) : null
                )}
              </div>

              {total > records.length && (
                <p className="mt-2 text-xs text-gray-500">
                  Badges above count all {total} records; the table below shows the {records.length} most recent.
                </p>
              )}

              {records.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No consent recorded for this project yet.</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="py-2 pr-4 font-medium">When</th>
                        <th className="py-2 pr-4 font-medium">Choice</th>
                        <th className="py-2 pr-4 font-medium">Categories</th>
                        <th className="py-2 pr-4 font-medium">Policy</th>
                        <th className="py-2 font-medium">Visitor</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {records.map((r) => (
                        <tr key={r.id} className="border-t border-gray-800/60">
                          <td className="py-2 pr-4 text-gray-400">{formatWhen(r.createdAt)}</td>
                          <td className="py-2 pr-4">{ACTION_LABELS[r.action]}</td>
                          <td className="py-2 pr-4 text-gray-400">
                            {r.categories.length > 0 ? r.categories.join(", ") : "—"}
                          </td>
                          <td className="py-2 pr-4 text-gray-400">{r.policyVersion ?? "—"}</td>
                          <td className="py-2 font-mono text-xs text-gray-500">{r.subjectRef}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
