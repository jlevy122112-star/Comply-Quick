import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import { listProjects } from "@/lib/projects-db";
import { PageHeader, PageTitle } from "@/components/ui";
import AssistantView from "./AssistantView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compliance Assistant",
  description: "Ask the Comply-Quick AI assistant about GDPR, CCPA, DPAs, cookie consent and more.",
};

export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/assistant");

  const [entitlement, projects] = await Promise.all([getEntitlement(), listProjects()]);
  const frameworks = Array.from(new Set(projects.map((p) => p.framework)));

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PageHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageTitle
          icon="💬"
          title="Compliance Assistant"
          description="Ask anything about privacy law, your obligations, or how to use Comply-Quick. Answers are grounded in the platform's own compliance datasets."
        />
        <AssistantView tier={entitlement.tier} projectCount={projects.length} frameworks={frameworks} />
      </main>
    </div>
  );
}
