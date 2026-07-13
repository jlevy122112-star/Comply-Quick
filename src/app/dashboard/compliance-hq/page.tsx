import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const INTERNAL_POLICY_SET = [
  "Information Security Policy",
  "Access Control Policy",
  "Data Classification and Handling Policy",
  "Data Retention and Deletion Policy",
  "Encryption and Key Management Policy",
  "Incident Response and Breach Notification Policy",
  "Vendor Risk Management Policy",
  "Business Continuity and Disaster Recovery Policy",
  "Change Management Policy",
  "Monitoring and Logging Policy",
  "Security Awareness and Training Policy",
  "Secure SDLC Policy",
];

const OPERATIONS_LOGS = [
  "Daily Founder Log",
  "Weekly KPI Review Log",
  "Incident and Postmortem Log",
  "Breach Event Log",
  "DSAR Request Log",
  "Subprocessor Change Log",
  "Vendor Review Log",
  "Compliance Evidence Register",
  "Release and Rollback Log",
  "Support SLA Tracking Log",
  "Dunning and Recovery Log",
  "Regulatory Watch Log",
  "Audit Readiness Log",
  "Launch Go/No-Go Log",
];

export default async function ComplianceHqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/compliance-hq");

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-10 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-gray-800 bg-gradient-to-br from-indigo-500/10 via-gray-900 to-gray-950 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Internal Use</p>
          <h1 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Compliance HQ</h1>
          <p className="mt-3 max-w-4xl text-sm text-gray-300 sm:text-base">
            Central operations space for Comply-Quick legal and compliance management. Use this hub to track policies,
            evidence, runbooks, and counsel-review packet readiness.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/legal/packet"
            className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 hover:border-indigo-500/50"
          >
            <h2 className="text-lg font-semibold text-white">Counsel Review Packet</h2>
            <p className="mt-2 text-sm text-gray-300">
              Formal white-label packet index for legal team review and sign-off.
            </p>
          </Link>
          <Link
            href="/legal"
            className="rounded-2xl border border-gray-800 bg-gray-900/70 p-5 hover:border-indigo-500/50"
          >
            <h2 className="text-lg font-semibold text-white">External Legal Center</h2>
            <p className="mt-2 text-sm text-gray-300">Public-facing legal documents currently visible to customers.</p>
          </Link>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-white">Internal Policy Baseline</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {INTERNAL_POLICY_SET.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm text-gray-300"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900/60 p-5 sm:p-6">
          <h2 className="text-xl font-semibold text-white">Notion HQ Operations Logs</h2>
          <p className="mt-2 text-sm text-gray-300">
            Maintain these logs in Notion for launch readiness and ongoing compliance operations.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {OPERATIONS_LOGS.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-gray-800 bg-gray-900/70 px-3 py-2 text-sm text-gray-300"
              >
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
