import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvidencePack, FRAMEWORKS_WITH_STATIC_CONTROLS } from "@/lib/evidence-service";
import { listEvidenceRecords } from "@/lib/evidence-db";
import type { RegulationFrameworkId } from "@/lib/regulations/sources/registry";
import { TabNav, type TabItem } from "@/components/ui";
import { EvidenceManager } from "./EvidenceManager";

export const dynamic = "force-dynamic";

const FRAMEWORK_LABELS: Partial<Record<RegulationFrameworkId, string>> = {
  soc2: "SOC 2",
  iso_27001: "ISO/IEC 27001",
  pci_dss: "PCI DSS",
};

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ framework?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/evidence");

  const { framework } = await searchParams;
  const available = FRAMEWORKS_WITH_STATIC_CONTROLS;
  const active = (
    available.includes(framework as RegulationFrameworkId) ? (framework as RegulationFrameworkId) : available[0]
  ) as RegulationFrameworkId;

  // The compiled pack reflects the persisted ledger; records give us the row ids
  // needed to update individual control statuses.
  const [pack, records] = await Promise.all([getEvidencePack(active), listEvidenceRecords(active)]);

  const tabs: TabItem[] = available.map((f) => ({ key: f, label: FRAMEWORK_LABELS[f] ?? f.toUpperCase() }));

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
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white">Audit &amp; Evidence</h1>
          <p className="mt-1 text-sm text-gray-400">
            A framework-specific, auditor-ready evidence pack. Mark each control&apos;s evidence as collected or
            out-of-scope; readiness updates automatically and is saved for your next audit.
          </p>
        </div>

        <div className="mt-6">
          <TabNav items={tabs} active={active} basePath="/dashboard/evidence" param="framework" />
        </div>

        <div className="mt-6">
          <EvidenceManager framework={active} pack={pack} records={records} />
        </div>
      </main>
    </div>
  );
}
