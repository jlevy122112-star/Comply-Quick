import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listAuditLogs } from "@/lib/audit-log";
import { EmptyState, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

const ACTION_TONE: Record<string, "emerald" | "amber" | "rose" | "sky" | "gray"> = {
  "proposal.accepted": "emerald",
  "proposal.rejected": "amber",
  "score.published": "sky",
  "score.revoked": "amber",
  "package.exported": "gray",
  "policy.regenerated": "sky",
};

function actionLabel(action: string): string {
  return action
    .split(".")
    .map((s) => s.replace(/_/g, " "))
    .join(" · ");
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function AuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/audit");

  const logs = await listAuditLogs({ limit: 200 });

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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Audit trail</h1>
          <p className="mt-1 text-sm text-gray-400">
            An immutable, append-only record of every consequential action — approvals, published scores, and exports.
            Entries can never be edited or deleted, so this is your defensible history for an audit.
          </p>
        </div>

        {logs.length === 0 ? (
          <EmptyState
            icon="🧾"
            title="No audit events yet"
            description="Approve a proposal, publish a score, or export a compliance package and it will appear here, permanently."
          />
        ) : (
          <ol className="relative space-y-4 border-l border-gray-800 pl-6">
            {logs.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-gray-600 ring-4 ring-gray-950" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={ACTION_TONE[entry.action] ?? "gray"}>{actionLabel(entry.action)}</Badge>
                  <span className="text-xs text-gray-500">{when(entry.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-gray-200">{entry.summary || actionLabel(entry.action)}</p>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}
