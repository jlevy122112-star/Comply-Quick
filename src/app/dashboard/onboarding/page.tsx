import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/onboarding");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <h1 className="text-2xl font-bold text-white">Guided Setup</h1>
          <p className="mt-1 text-sm text-gray-400">
            Answer a few questions and the Onboarding agent will configure your first compliance project.
          </p>
        </div>
        <OnboardingWizard />
      </main>
    </div>
  );
}
