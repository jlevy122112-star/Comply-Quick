import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import { buildGitHubAppInstallUrl } from "@/lib/github/app-service";
import { signState } from "@/lib/github/state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/github");

  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/dashboard/tools/github?error=no_org");
  const role = await getMyOrgRole(organizationId);
  if (role !== "owner" && role !== "admin") redirect("/dashboard/tools/github?error=forbidden");

  const secret = process.env.CRON_SECRET;
  if (!secret) redirect("/dashboard/tools/github?error=not_configured");

  const url = new URL(request.url);
  const flow = url.searchParams.get("flow") === "repo" ? "repo" : "org";
  const repoFullName = url.searchParams.get("repo");
  const repositoryId = Number.parseInt(url.searchParams.get("repositoryId") ?? "", 10);
  const state = signState(secret, {
    organizationId,
    flow,
    repoFullName,
    repositoryId: Number.isInteger(repositoryId) ? repositoryId : null,
  });

  redirect(
    buildGitHubAppInstallUrl({
      flow,
      state,
      repositoryId: Number.isInteger(repositoryId) ? repositoryId : null,
    })
  );
}
