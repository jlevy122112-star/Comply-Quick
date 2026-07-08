import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageTitle } from "@/components/ui";
import SubprocessorTool from "./SubprocessorTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Subprocessor Mapping",
  description: "Map where customer data flows across your tracking vendors and export an Art. 30 register.",
};

export default async function SubprocessorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/subprocessors");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PageHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageTitle
          icon="🔗"
          title="Subprocessor Mapping"
          description="Map which third parties receive customer data, for what purpose, and where users can opt out — the register your DPA and GDPR Art. 30 record require."
        />
        <SubprocessorTool />
      </main>
    </div>
  );
}
