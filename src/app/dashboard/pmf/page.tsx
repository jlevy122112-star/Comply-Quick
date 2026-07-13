import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPmfSummary } from "@/lib/pmf/service";
import { isPmfAdmin, toPercent, CHURN_REASON_LABELS, type ChurnReason } from "@/lib/pmf/metrics";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export default async function PmfDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/pmf");

  if (!isPmfAdmin(user.email ?? null, process.env.PMF_ADMIN_EMAILS)) redirect("/dashboard/home");

  const s = await getPmfSummary();
  const npsChannels = Object.entries(s.nps.byChannel).sort((a, b) => b[1].count - a[1].count);
  const churnReasons = Object.entries(s.churn.byReason).sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-200">
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Product-Market Fit</h1>
            <p className="mt-1 text-sm text-gray-500">NPS, retention, and churn signals.</p>
          </div>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Dashboard
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Net Promoter Score</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="NPS" value={String(s.nps.overall.nps)} sub={`${s.nps.overall.count} responses`} />
            <Stat label="Promoters" value={String(s.nps.overall.promoters)} />
            <Stat label="Passives" value={String(s.nps.overall.passives)} />
            <Stat label="Detractors" value={String(s.nps.overall.detractors)} />
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Subscription funnel</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Signups" value={String(s.subscriptions.total)} />
            <Stat label="Paid" value={String(s.subscriptions.paid)} />
            <Stat label="Trial → Paid" value={`${toPercent(s.subscriptions.trialToPaid)}%`} />
            <Stat
              label="Active retention"
              value={`${toPercent(s.subscriptions.activeRetention)}%`}
              sub={`${s.subscriptions.canceled} canceled`}
            />
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">NPS by channel</h2>
            <div className="mt-3 space-y-2">
              {npsChannels.length === 0 && <p className="text-sm text-gray-500">No responses yet.</p>}
              {npsChannels.map(([channel, summary]) => (
                <div
                  key={channel}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm"
                >
                  <span className="text-gray-300">{channel}</span>
                  <span className="text-gray-400">
                    NPS <span className="font-semibold text-white">{summary.nps}</span> · {summary.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Churn reasons</h2>
            <div className="mt-3 space-y-2">
              {churnReasons.length === 0 && <p className="text-sm text-gray-500">No cancellations recorded.</p>}
              {churnReasons.map(([reason, count]) => (
                <div
                  key={reason}
                  className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-2 text-sm"
                >
                  <span className="text-gray-300">{CHURN_REASON_LABELS[reason as ChurnReason] ?? reason}</span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
