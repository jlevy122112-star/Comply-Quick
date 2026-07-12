import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageTitle } from "@/components/ui";
import CookiePolicyTool from "./CookiePolicyTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookie Policy Generator",
  description: "Generate a jurisdiction-aware cookie policy with a per-vendor technology disclosure table.",
};

export default async function CookiePolicyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/cookie-policy");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PageHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageTitle
          icon="📃"
          title="Cookie Policy"
          description="A regulator-ready cookie policy whose disclosures adapt to your jurisdictions and the tracking technologies you run. It stays in sync with your cookie banner and subprocessor register."
        />
        <CookiePolicyTool />
      </main>
    </div>
  );
}
