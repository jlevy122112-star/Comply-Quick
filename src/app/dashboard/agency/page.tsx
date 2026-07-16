import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import {
  canUseAgencyPortal,
  getOrCreateAgency,
  listClients,
  listDomains,
  getClientStats,
  listMembers,
} from "@/lib/agency/service";
import { getBillingSummary } from "@/lib/billing/usage";
import { canonicalAppHost } from "@/lib/appHost";
import { tierLabel, upgradeTargetFor } from "@/lib/tier-copy";
import AgencyPortalView from "./AgencyPortalView";

export const dynamic = "force-dynamic";

export default async function AgencyPortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/agency");

  const entitlement = await getEntitlement();
  if (!(await canUseAgencyPortal())) {
    const upgradeTarget = upgradeTargetFor(entitlement.tier, "agencyPortal");
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
              &larr; Command Center
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-4xl mb-4">🏢</p>
          <h1 className="text-2xl font-bold text-white mb-2">Agency Client Portal</h1>
          <p className="text-gray-400 mb-6">
            Manage unlimited client workspaces, white-label the dashboard with your brand, and put it on your own
            domain. Available on the <strong className="text-indigo-300">{tierLabel("agency")}</strong> and{" "}
            <strong className="text-amber-300">{tierLabel("enterprise")}</strong> plans.
          </p>
          <Link
            href="/#pricing"
            className="inline-block px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 transition-colors"
          >
            {upgradeTarget ? `Upgrade to ${tierLabel(upgradeTarget)} to unlock the portal` : "View portal access"}
          </Link>
        </main>
      </div>
    );
  }

  const [agency, clients, domains, stats, members, billing] = await Promise.all([
    getOrCreateAgency(),
    listClients(),
    listDomains(),
    getClientStats(),
    listMembers(),
    getBillingSummary(),
  ]);

  return (
    <AgencyPortalView
      agency={agency}
      clients={clients}
      domains={domains}
      stats={stats}
      tier={entitlement.tier}
      appHost={canonicalAppHost()}
      members={members}
      billing={billing}
    />
  );
}
