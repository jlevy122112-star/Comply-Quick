import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { listProjects, getAggregateScore } from "@/lib/projects-db";
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

  const [entitlement, projects] = await Promise.all([getEntitlement(), listProjects()]);
  const aggregateScore = getAggregateScore(projects);

  return (
    <CommandCenterView
      projects={projects}
      tier={entitlement.tier}
      aggregateScore={aggregateScore}
      userEmail={user.email ?? null}
    />
  );
}
