import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { getWorkspaceData } from "@/lib/workspace/data";
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

  return <WorkspaceView data={data} tier={entitlement.tier} activeTab={activeTab} />;
}
