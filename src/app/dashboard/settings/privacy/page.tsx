import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RETENTION_POLICY } from "@/lib/privacy/retention";
import { PrivacyPanel } from "./PrivacyPanel";

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/settings/privacy");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard/home" className="text-lg font-bold tracking-tight text-white">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Privacy &amp; Your Data</h1>
          <p className="mt-1 text-sm text-gray-400">
            Export a copy of your data, review how long it is retained, or permanently delete your account.
          </p>
        </div>
        <PrivacyPanel accountEmail={user.email ?? ""} retention={RETENTION_POLICY} />
      </main>
    </div>
  );
}
