import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyOrgRole } from "@/lib/organizations-db";
import { getInstallationDetails, getInstallationPermissions } from "@/lib/github/app-service";
import { verifyState } from "@/lib/github/state";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const installationIdRaw = searchParams.get("installation_id");
  const state = searchParams.get("state");
  const setupAction = searchParams.get("setup_action");
  const error = searchParams.get("error");
  const redirectBase = "/dashboard/tools/github";

  if (error || !state) {
    redirect(`${redirectBase}?error=${error ?? "invalid_request"}`);
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) redirect(`${redirectBase}?error=not_configured`);

  const parsed = verifyState(secret, state);
  if (!parsed) {
    redirect(`${redirectBase}?error=invalid_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${redirectBase}`);

  const role = await getMyOrgRole(parsed.organizationId);
  if (role !== "owner" && role !== "admin") {
    redirect(`${redirectBase}?error=forbidden`);
  }

  if (setupAction === "request" && !installationIdRaw) {
    redirect(`${redirectBase}?success=requested&flow=${parsed.flow}`);
  }

  const installationId = Number.parseInt(installationIdRaw ?? "", 10);
  if (!Number.isInteger(installationId)) {
    redirect(`${redirectBase}?error=missing_installation_id`);
  }

  try {
    const details = await getInstallationDetails(installationId);
    const admin = createAdminClient();
    await admin
      .schema("connector")
      .from("connector_connections")
      .upsert(
        {
          agency_org_id: parsed.organizationId,
          platform: "github",
          external_account_id: `installation:${installationId}`,
          status: "active",
          mode: "propose_only",
          scopes: Object.entries(getInstallationPermissions()).map(([scope, level]) => `${scope}:${level}`),
          integration_type: "github_app",
          github_installation_id: installationId,
          github_installation_target_type: details.targetType,
          github_installation_target_login: details.targetLogin,
          github_repository_selection: details.repositorySelection,
          install_metadata: {
            accountType: details.accountType,
            htmlUrl: details.htmlUrl,
            requestedFlow: parsed.flow,
            requestedRepoFullName: parsed.repoFullName ?? null,
            requestedRepositoryId: parsed.repositoryId ?? null,
            permissions: details.permissions,
          },
          last_verified_at: new Date().toISOString(),
        },
        { onConflict: "github_installation_id" }
      );

    redirect(`${redirectBase}?success=connected&flow=${parsed.flow}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    redirect(`${redirectBase}?error=${encodeURIComponent(message)}`);
  }
}
