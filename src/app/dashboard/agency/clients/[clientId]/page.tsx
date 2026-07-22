import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseAgencyPortal, listClients } from "@/lib/agency/service";
import { getClientDashboard } from "@/lib/agency/client-dashboard";
import { ClientDashboardView } from "@/components/client-portal/ClientDashboardView";

export const dynamic = "force-dynamic";

export default async function AgencyClientDashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/agency/clients/${clientId}`);

  if (!(await canUseAgencyPortal())) redirect("/dashboard/agency");

  const [dashboard, clients] = await Promise.all([
    getClientDashboard(clientId).catch((error) => {
      if (error instanceof Error && error.message.includes("not found")) return notFound();
      throw error;
    }),
    listClients(),
  ]);

  if (!dashboard || typeof dashboard === "string") return notFound();

  return (
    <ClientDashboardView
      dashboard={dashboard}
      backHref="/dashboard/agency"
      portalLabel="Agency Portal"
      clients={clients}
    />
  );
}
