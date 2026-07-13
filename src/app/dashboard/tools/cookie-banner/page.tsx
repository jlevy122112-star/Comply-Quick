import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageTitle } from "@/components/ui";
import { listProjects } from "@/lib/projects-db";
import CookieBannerTool from "./CookieBannerTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookie Consent Banner Generator",
  description: "Generate a jurisdiction-aware cookie consent banner mapped to your tracking pixels.",
};

export default async function CookieBannerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/cookie-banner");

  const projects = await listProjects();
  const consentEndpoint = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://comply-quick.com").replace(/\/$/, "")}/api/consent`;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PageHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageTitle
          icon="🍪"
          title="Cookie Consent Banner"
          description="A ready-to-embed consent banner whose behavior adapts to your jurisdictions (opt-in / opt-out / notice) and the tracking pixels it needs to gate."
        />
        <CookieBannerTool
          projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          consentEndpoint={consentEndpoint}
        />
      </main>
    </div>
  );
}
