import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import {
  canUseEnterprisePortal,
  getOrCreateAgency,
  listClients,
  listDomains,
  getClientStats,
  listAgencyClientAssignments,
  listMembers,
  getAgencyAccess,
} from "@/lib/agency/service";
import { getAgencyPortfolioAnalytics } from "@/lib/agency/analytics";
import { getBillingSummary } from "@/lib/billing/usage";
import { getAgencyAlerts } from "@/lib/agency/client-dashboard";
import { canonicalAppHost } from "@/lib/appHost";
import { tierLabel, upgradeTargetFor } from "@/lib/tier-copy";
import { managedClientLimit } from "@/lib/pricing";
import AgencyPortalView from "../agency/AgencyPortalView";

export const dynamic = "force-dynamic";

export default async function EnterprisePortalPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/enterprise");

  const entitlement = await getEntitlement();
  if (!(await canUseEnterprisePortal())) {
    const upgradeTarget = upgradeTargetFor(entitlement.tier, "enterprisePortal");
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800/50">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
              Comply-Quick
            </Link>
            <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
              &larr; Command Center
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-20 text-center">
          <p className="mb-4 text-4xl">🏢</p>
          <h1 className="mb-2 text-2xl font-bold text-white">Enterprise Client Portal</h1>
          <p className="mb-6 text-gray-400">
            Manage unlimited client workspaces with stricter security, dedicated SSO/SCIM, field-level encryption, and
            advanced compliance modules. Available on the{" "}
            <strong className="text-amber-300">{tierLabel("enterprise")}</strong> plan.
          </p>
          <Link
            href="/#pricing"
            className="inline-block rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-500"
          >
            {upgradeTarget ? `Upgrade to ${tierLabel(upgradeTarget)} to unlock the portal` : "View portal access"}
          </Link>
        </main>
      </div>
    );
  }

  const [agency, clients, domains, stats, members, billing, portfolioAnalytics, access, alerts] = await Promise.all([
    getOrCreateAgency(),
    listClients(),
    listDomains(),
    getClientStats(),
    listMembers(),
    getBillingSummary(),
    getAgencyPortfolioAnalytics(),
    getAgencyAccess(),
    getAgencyAlerts(),
  ]);

  // Enterprise portal is owner-only; treat the owner as the only assignable role.
  const assignments =
    access.role === "owner" ? await listAgencyClientAssignments(clients.map((client) => client.id)) : {};

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
      managedClientLimit={managedClientLimit(entitlement.tier)}
      portfolioAnalytics={portfolioAnalytics}
      agencyRole={access.role}
      assignments={assignments}
      alerts={alerts}
    />
  );
}
