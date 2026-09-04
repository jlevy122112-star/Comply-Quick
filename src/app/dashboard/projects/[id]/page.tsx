import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { getWorkspaceData } from "@/lib/workspace/data";
import { getMyOrgRole } from "@/lib/organizations-db";
import { can } from "@/lib/rbac";
import { getWorkspaceById } from "@/lib/workspaces-db";
import { WorkspaceView, WORKSPACE_TABS, type WorkspaceTabKey } from "./WorkspaceView";

export const dynamic = "force-dynamic";

export default async function ProjectWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/projects/${id}`);

  const [data, entitlement] = await Promise.all([getWorkspaceData(id), getEntitlement()]);
  if (!data) notFound();

  const activeTab: WorkspaceTabKey = WORKSPACE_TABS.some((t) => t.key === tab) ? (tab as WorkspaceTabKey) : "overview";

  let installation:
    | {
        workspace: { id: string; organizationId: string; name: string; slug: string; projectCount: number; createdAt: string };
        keys: {
          id: string;
          name: string;
          keyPrefix: string;
          lastUsedAt: string | null;
          revokedAt: string | null;
          createdAt: string;
        }[];
        canManage: boolean;
      }
    | null = null;

  if (activeTab === "settings" && data.project.workspaceId) {
    const workspace = await getWorkspaceById(data.project.workspaceId);
    if (workspace) {
      const role = await getMyOrgRole(workspace.organizationId);
      const { data: keyRows } = await supabase
        .from("client_api_keys")
        .select("id,name,key_prefix,last_used_at,revoked_at,created_at")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false });
      installation = {
        workspace,
        canManage: can(role ?? "viewer", "org:update"),
        keys: ((keyRows as Record<string, unknown>[] | null) ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name),
          keyPrefix: String(row.key_prefix),
          lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
          revokedAt: row.revoked_at ? String(row.revoked_at) : null,
          createdAt: String(row.created_at),
        })),
      };
    }
  }

  return <WorkspaceView data={data} tier={entitlement.tier} activeTab={activeTab} installation={installation} />;
}
