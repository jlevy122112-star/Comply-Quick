import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { listProjects, getAggregateScore } from "@/lib/projects-db";
import { listCompletedTools } from "@/lib/tools/usage";
import { isLegalAdmin } from "@/lib/legal/review";
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

  const [entitlement, projects, completedTools] = await Promise.all([
    getEntitlement(),
    listProjects(),
    listCompletedTools(),
  ]);
  const aggregateScore = getAggregateScore(projects);

  return (
    <CommandCenterView
      projects={projects}
      tier={entitlement.tier}
      aggregateScore={aggregateScore}
      completedTools={completedTools}
      userEmail={user.email ?? null}
      isLegalAdmin={isLegalAdmin(user.email ?? null, process.env.LEGAL_REVIEW_ADMIN_EMAILS)}
    />
  );
}
