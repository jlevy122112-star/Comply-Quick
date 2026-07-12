import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseAgencyPortal, getClient } from "@/lib/agency/service";
import { getIntake } from "@/lib/agency/onboarding";
import { IntakeWizard } from "./IntakeWizard";

export const dynamic = "force-dynamic";

export default async function ClientIntakePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/agency/clients/${clientId}/intake`);

  if (!(await canUseAgencyPortal())) redirect("/dashboard/agency");

  const client = await getClient(clientId);
  if (!client) notFound();

  const intake = await getIntake(clientId);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard/agency" className="text-sm text-gray-400 transition-colors hover:text-white">
            &larr; Agency Portal
          </Link>
          <span className="rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
            Client Onboarding
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <IntakeWizard
          clientId={clientId}
          clientName={client.name}
          clientWebsite={client.websiteUrl}
          initialAnswers={intake?.answers ?? null}
          initialStatus={intake?.status ?? "draft"}
          initialUpdatedAt={intake?.updatedAt ?? null}
        />
      </main>
    </div>
  );
}
