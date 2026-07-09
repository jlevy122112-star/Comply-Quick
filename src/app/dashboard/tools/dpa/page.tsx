import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, PageTitle } from "@/components/ui";
import DpaTool from "./DpaTool";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DPA Template Builder",
  description: "Generate a controller–processor Data Processing Agreement with a subprocessor annex.",
};

export default async function DpaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/dpa");

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <PageHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <PageTitle
          icon="📄"
          title="DPA Template Builder"
          description="A controller–processor Data Processing Agreement whose clauses adapt to your jurisdictions, subprocessors, and security modules — with Annex I & II filled in automatically."
        />
        <DpaTool />
      </main>
    </div>
  );
}
