import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import { listNativeIntegrations } from "@/lib/native-integrations-db";
import { listWorkspaces } from "@/lib/workspaces-db";
import PlatformIntegrationsTool from "./PlatformIntegrationsTool";
import CmsConnectionsPanel from "./CmsConnectionsPanel";

export const dynamic = "force-dynamic";

export default async function PlatformIntegrationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/platforms");

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/dashboard/tools" className="text-sm text-gray-500 hover:text-gray-300">
            ← Back to tools
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Platform Integrations</h1>
          <p className="mt-1 text-sm text-gray-400">
            Generate copy-paste consent banners and policy links for the most common website builders and CMSs.
          </p>
        </div>
        <PlatformIntegrationsTool />
        {organizationId ? (
          <CmsConnectionsPanel
            connections={nativeIntegrations}
            workspaces={workspaces}
            clients={agencyClients}
            canManage={canManage}
          />
        ) : null}
      </div>
    </div>
  );
}
