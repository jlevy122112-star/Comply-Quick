import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, TabNav, type TabItem } from "@/components/ui";
import { ROLE_LABELS, can } from "@/lib/rbac";
import { getOrCreateOrganization, getMyOrgRole, listOrgMembers } from "@/lib/organizations-db";
import { listWorkspaces } from "@/lib/workspaces-db";
import { listSsoConnections, ssoEnabled } from "@/lib/sso-db";
import { OrgProfilePanel } from "./OrgProfilePanel";
import { MembersPanel } from "./MembersPanel";
import { WorkspacesPanel } from "./WorkspacesPanel";
import { SsoPanel } from "./SsoPanel";

export const dynamic = "force-dynamic";

const BASE = "/dashboard/settings/organization";
type Tab = "profile" | "members" | "workspaces" | "sso";

export default async function OrganizationSettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const org = await getOrCreateOrganization();
  if (!org) redirect("/login?redirect=/dashboard/settings/organization");

  const role = (await getMyOrgRole(org.id)) ?? "viewer";
  const { tab: tabParam } = await searchParams;
  const tab: Tab = (["profile", "members", "workspaces", "sso"] as const).includes(tabParam as Tab)
    ? (tabParam as Tab)
    : "profile";

  const [members, workspaces, sso] = await Promise.all([
    listOrgMembers(org.id),
    listWorkspaces(org.id),
    listSsoConnections(org.id),
  ]);

  const tabs: TabItem[] = [
    { key: "profile", label: "Profile" },
    { key: "members", label: "Members", count: members.length },
    { key: "workspaces", label: "Workspaces", count: workspaces.length },
    { key: "sso", label: "SSO" },
  ];

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

        {tab === "profile" && <OrgProfilePanel org={org} canManage={can(role, "org:update")} />}
        {tab === "members" && <MembersPanel orgId={org.id} role={role} members={members} />}
        {tab === "workspaces" && <WorkspacesPanel orgId={org.id} role={role} workspaces={workspaces} />}
        {tab === "sso" && <SsoPanel orgId={org.id} role={role} connections={sso} live={ssoEnabled()} />}
      </main>
    </div>
  );
}
