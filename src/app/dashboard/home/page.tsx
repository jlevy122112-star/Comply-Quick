import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { listProjects, getAggregateScore } from "@/lib/projects-db";
import { listCompletedTools } from "@/lib/tools/usage";
import { getScanUsage } from "@/lib/billing/usage";
import { listMyOrganizationsCached, resolveActiveOrganizationId } from "@/lib/organizations-db";
import { isEmailPolicyAllowed } from "@/lib/access-policy";
import CommandCenterView from "./CommandCenterView";

export const dynamic = "force-dynamic";

export default async function CommandCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/dashboard/home");
  }

  const [entitlement, projects, completedTools, organizations, activeOrganizationId, scanUsage] = await Promise.all([
    getEntitlement(),
    listProjects(),
    listCompletedTools(),
    listMyOrganizationsCached(),
    resolveActiveOrganizationId(),
    getScanUsage().catch(() => null),
  ]);
  const aggregateScore = getAggregateScore(projects);

  return (
    <CommandCenterView
      projects={projects}
      tier={entitlement.tier}
      aggregateScore={aggregateScore}
      completedTools={completedTools}
      scanUsage={scanUsage}
      organizations={organizations}
      activeOrganizationId={activeOrganizationId}
      userEmail={user.email ?? null}
      isLegalAdmin={isEmailPolicyAllowed("legalReview", user.email ?? null, process.env)}
    />
  );
}
