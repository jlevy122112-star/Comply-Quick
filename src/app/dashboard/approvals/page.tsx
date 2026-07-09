import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listProposals, type ProposalListItem } from "@/lib/autopilot/service";
import { Badge, Card, CardBody, EmptyState } from "@/components/ui";
import { ApprovalActions } from "../projects/[id]/ApprovalActions";

export const dynamic = "force-dynamic";

/** Safely reads the +/- line counts off a proposal's stored diff (shape: DocumentDiff). */
function lineDelta(diff: unknown): { added: number; removed: number } {
  const d = (diff ?? {}) as { addedLines?: unknown; removedLines?: unknown };
  const added = typeof d.addedLines === "number" ? d.addedLines : 0;
  const removed = typeof d.removedLines === "number" ? d.removedLines : 0;
  return { added, removed };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ProposalCard({ p, pending }: { p: ProposalListItem; pending: boolean }) {
  const { added, removed } = lineDelta(p.diff);
  return (
    <Card>
      <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/projects/${p.projectId}?tab=approvals`}
              className="text-sm font-semibold text-white hover:text-indigo-300"
            >
              {p.projectName}
            </Link>
            {(added > 0 || removed > 0) && (
              <span className="font-mono text-xs text-gray-500">
                <span className="text-emerald-400">+{added}</span> / <span className="text-rose-400">−{removed}</span>
              </span>
            )}
            {!pending && <Badge tone={p.status === "accepted" ? "emerald" : "gray"}>{p.status}</Badge>}
          </div>
          <p className="mt-1.5 text-sm text-gray-300">{p.summary || "Proposed regulatory update."}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {pending ? "Proposed" : p.status === "accepted" ? "Approved" : "Rejected"}{" "}
            {fmtDate(pending ? p.createdAt : (p.resolvedAt ?? p.createdAt))}
          </p>
        </div>
        {pending && <ApprovalActions proposalId={p.id} />}
      </CardBody>
    </Card>
  );
}

/**
 * Unified Approvals queue (framework §3.9 / C10). Aggregates every
 * human-in-the-loop proposal across all of the user's projects into a single
 * queue — regulatory-change document updates drafted by the Autopilot
 * Remediation agent — so approvals aren't buried per-project. Each decision is
 * recorded to the immutable audit trail via {@link resolveProposal}.
 */
export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/approvals");

  const all = await listProposals("all");
  const pending = all.filter((p) => p.status === "proposed");
  const resolved = all.filter((p) => p.status !== "proposed").slice(0, 10);

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
            <h1 className="text-2xl font-bold text-white">Approvals</h1>
            <p className="mt-1 text-sm text-gray-400">
              Every proposed change across your projects in one queue. Nothing is applied until you approve it.
            </p>
          </div>
          {pending.length > 0 && <Badge tone="amber">{pending.length} awaiting review</Badge>}
        </div>

        <section className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-gray-300">Awaiting your review</h2>
          {pending.length === 0 ? (
            <EmptyState
              icon="✅"
              title="Nothing to approve"
              description="When a regulatory change is detected, the proposed document update will appear here for your approval."
            />
          ) : (
            <div className="space-y-3">
              {pending.map((p) => (
                <ProposalCard key={p.id} p={p} pending />
              ))}
            </div>
          )}
        </section>

        {resolved.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-semibold text-gray-300">Recently resolved</h2>
            <div className="space-y-3">
              {resolved.map((p) => (
                <ProposalCard key={p.id} p={p} pending={false} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
