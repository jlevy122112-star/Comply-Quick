import Link from "next/link";
import { redirect } from "next/navigation";
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href="/dashboard/tools" className="text-sm text-gray-500 hover:text-gray-300">
            ← Back to tools
          </Link>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">GitHub integration</h1>
          <p className="mt-1 text-sm text-gray-400">
            Connect GitHub repositories and scan source code for compliance signals.
          </p>
        </div>
        <GitHubIntegrationTool />
      </div>
    </div>
  );
}
