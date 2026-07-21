import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge, TabNav, type TabItem } from "@/components/ui";
import { ROLE_LABELS, can } from "@/lib/rbac";
import { getOrCreateOrganization, getMyOrgRole, listOrgMembers, countOrgMembers } from "@/lib/organizations-db";
import { listWorkspaces, countWorkspaces } from "@/lib/workspaces-db";
import { listSsoConnections, ssoEnabled } from "@/lib/sso-db";
import { listScimTokens, scimEnabled } from "@/lib/scim/tokens";
import { listScimUsers } from "@/lib/scim/provisioning";
import { getFeatureFlag, listFeatureFlags } from "@/lib/feature-flags";
import { listMyOrganizations } from "@/lib/organizations-db";
import { OrgProfilePanel } from "./OrgProfilePanel";
import { BrandLogoPanel } from "./BrandLogoPanel";
import { MembersPanel } from "./MembersPanel";
import { WorkspacesPanel } from "./WorkspacesPanel";
import { SsoPanel } from "./SsoPanel";
import { ScimPanel } from "./ScimPanel";
import { HierarchyPanel } from "./HierarchyPanel";
import { FeatureFlagsPanel } from "./FeatureFlagsPanel";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/settings/organization";
type Tab = "profile" | "members" | "workspaces" | "hierarchy" | "features" | "sso" | "scim";

export default async function OrganizationSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const org = await getOrCreateOrganization();
  if (!org) redirect("/login?redirect=/dashboard/settings/organization");

  const role = (await getMyOrgRole(org.id)) ?? "viewer";
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (
    ["profile", "members", "workspaces", "hierarchy", "features", "sso", "scim"] as const
  ).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : "profile";

  // Cheap counts drive the tab badges on every load; the heavy list (member
  // email resolution, workspace project tallies, SSO rows) is fetched only for
  // the active tab so, e.g., viewing Profile never pays the members email cost.
  const [memberCount, workspaceCount, hierarchyEnabled] = await Promise.all([
    countOrgMembers(org.id),
    countWorkspaces(org.id),
    getFeatureFlag(org.id, "enterpriseHierarchy"),
  ]);
  const members = tab === "members" ? await listOrgMembers(org.id) : [];
  const workspaces = tab === "workspaces" ? await listWorkspaces(org.id) : [];
  const hierarchyOrgs = tab === "hierarchy" ? await listMyOrganizations() : [];
  const featureFlags = tab === "features" ? await listFeatureFlags(org.id) : [];
  const sso = tab === "sso" ? await listSsoConnections(org.id) : [];
  const scimTokens = tab === "scim" ? await listScimTokens(org.id) : [];
  const scimUsers = tab === "scim" ? (await listScimUsers(org.id, { limit: 200 })).users : [];

  const tabs: TabItem[] = [
    { key: "profile", label: "Profile" },
    { key: "members", label: "Members", count: memberCount },
    { key: "workspaces", label: "Workspaces", count: workspaceCount },
    { key: "hierarchy", label: "Hierarchy" },
    { key: "features", label: "Features" },
    { key: "sso", label: "SSO" },
    { key: "scim", label: "SCIM" },
  ];

  let scimBaseUrl = "/api/scim/v2";
  if (tab === "scim") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) scimBaseUrl = `${proto}://${host}/api/scim/v2`;
  }

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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{org.name}</h1>
            <p className="mt-1 text-sm text-gray-400">Organization, workspaces, team roles, and single sign-on.</p>
          </div>
          <Badge tone="indigo">Your role: {ROLE_LABELS[role]}</Badge>
        </div>

        <TabNav items={tabs} active={tab} basePath={BASE} className="mb-6" />

        {tab === "profile" && (
          <div className="space-y-6">
            <OrgProfilePanel org={org} canManage={can(role, "org:update")} />
            <BrandLogoPanel />
          </div>
        )}
        {tab === "members" && <MembersPanel orgId={org.id} role={role} members={members} />}
        {tab === "workspaces" && <WorkspacesPanel orgId={org.id} role={role} workspaces={workspaces} />}
        {tab === "hierarchy" && (
          <HierarchyPanel
            orgs={hierarchyOrgs}
            currentOrgId={org.id}
            role={role}
            isEnabled={hierarchyEnabled}
          />
        )}
        {tab === "features" && <FeatureFlagsPanel orgId={org.id} role={role} flags={featureFlags} />}
        {tab === "sso" && <SsoPanel orgId={org.id} role={role} connections={sso} live={ssoEnabled()} />}
        {tab === "scim" && (
          <ScimPanel
            orgId={org.id}
            role={role}
            tokens={scimTokens}
            users={scimUsers}
            baseUrl={scimBaseUrl}
            live={scimEnabled()}
          />
        )}
      </main>
    </div>
  );
}
