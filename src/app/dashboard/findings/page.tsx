import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listFindings, countFindings, type FindingStatus } from "@/lib/findings-db";
import { EmptyState, Badge, TabNav, type TabItem } from "@/components/ui";
import { FindingsManager } from "./FindingsManager";

export const dynamic = "force-dynamic";

const STATUS_FILTERS: { key: string; label: string; status?: FindingStatus }[] = [
  { key: "open", label: "Open", status: "open" },
  { key: "in_progress", label: "In Progress", status: "in_progress" },
  { key: "reopened", label: "Reopened", status: "reopened" },
  { key: "resolved", label: "Resolved", status: "resolved" },
  { key: "all", label: "All" },
];

export default async function FindingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/findings");

  const { status } = await searchParams;
  const active = STATUS_FILTERS.find((f) => f.key === status) ?? STATUS_FILTERS[0];
  const findings = await listFindings(active.status ? { status: active.status } : undefined);

  const openCount = await countFindings("open");

  const tabs: TabItem[] = STATUS_FILTERS.map((f) => ({ key: f.key, label: f.label }));

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
            <h1 className="text-2xl font-bold text-white">Findings</h1>
            <p className="mt-1 text-sm text-gray-400">
              Every issue your scans have surfaced — tracked, assignable, and reconciled across re-scans.
            </p>
          </div>
          {openCount > 0 && <Badge tone="rose">{openCount} open</Badge>}
        </div>

        <div className="mt-6">
          <TabNav items={tabs} active={active.key} basePath="/dashboard/findings" param="status" />
        </div>

        <div className="mt-6">
          {findings.length === 0 ? (
            <EmptyState
              icon="🔎"
              title={active.key === "open" ? "No open findings" : "Nothing here"}
              description={
                active.key === "open"
                  ? "Run a scan from the Command Center and any compliance risks will appear here as trackable findings."
                  : "No findings match this filter."
              }
            />
          ) : (
            <FindingsManager findings={findings} />
          )}
        </div>
      </main>
    </div>
  );
}
