import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listIntegrations } from "@/lib/integrations-db";
import { listNativeIntegrations } from "@/lib/native-integrations-db";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import { listWorkspaces } from "@/lib/workspaces-db";
import { IntegrationsManager } from "./IntegrationsManager";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/settings/integrations");

  const integrations = await listIntegrations();
  const organizationId = await getActiveOrganizationId();
  const role = organizationId ? await getMyOrgRole(organizationId) : null;
  const canManage = role === "owner" || role === "admin";
  const [nativeIntegrations, workspaces, agencyClients] = organizationId
    ? await Promise.all([
        listNativeIntegrations({ organizationId }),
        listWorkspaces(organizationId),
        supabase
          .from("agency_clients")
          .select("id, name")
          .eq("organization_id", organizationId)
          .eq("status", "active")
          .order("name", { ascending: true })
          .then(({ data }) => (data ?? []) as Array<{ id: string; name: string }>),
      ])
    : [[], [], [] as Array<{ id: string; name: string }>];

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
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
          <p className="mt-1 text-sm text-gray-400">
            Manage first-class native CMS integrations and advanced/custom webhook destinations.
          </p>
        </div>
        <IntegrationsManager
          integrations={integrations}
          nativeIntegrations={nativeIntegrations}
          workspaces={workspaces}
          clients={agencyClients}
          canManage={canManage}
        />
      </main>
    </div>
  );
}
