import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { listProjects, getAggregateScore } from "@/lib/projects-db";
import { listCompletedTools } from "@/lib/tools/usage";
import { isEmailPolicyAllowed } from "@/lib/access-policy";
import { listMyOrganizationsCached, resolveActiveOrganizationId } from "@/lib/organizations-db";
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

  const [entitlement, projects, completedTools, organizations, activeOrganizationId] = await Promise.all([
    getEntitlement(),
    listProjects(),
    listCompletedTools(),
    listMyOrganizationsCached(),
    resolveActiveOrganizationId(),
  ]);
  const aggregateScore = getAggregateScore(projects);

  return (
    <CommandCenterView
      projects={projects}
      tier={entitlement.tier}
      aggregateScore={aggregateScore}
      completedTools={completedTools}
      organizations={organizations}
      activeOrganizationId={activeOrganizationId}
      userEmail={user.email ?? null}
      isLegalAdmin={isEmailPolicyAllowed("legalReview", user.email ?? null, process.env)}
    />
  );
}
