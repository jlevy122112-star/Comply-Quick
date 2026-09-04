import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import GitHubIntegrationTool from "./GitHubIntegrationTool";

export const dynamic = "force-dynamic";

export default async function GitHubIntegrationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/github");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/dashboard/tools" className="text-sm text-gray-500 hover:text-gray-300">
            ← Back to tools
          </Link>
          <div className="flex flex-wrap gap-2">
            <Badge tone="indigo">Phase 2 · Step 2</Badge>
            <Badge tone="emerald">Enterprise monitoring</Badge>
          </div>
        </div>
        <div className="mb-8 max-w-3xl">
          <h1 className="text-3xl font-semibold text-white">GitHub App Compliance Monitoring</h1>
          <p className="mt-2 text-sm text-gray-400">
            Replace user-scoped OAuth with repo-safe GitHub App installs, webhook-driven monitoring, and async
            compliance queue execution.
          </p>
        </div>
        <GitHubIntegrationTool />
      </div>
    </div>
  );
}
