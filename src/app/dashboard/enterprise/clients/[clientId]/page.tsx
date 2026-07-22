import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseEnterprisePortal, listClients } from "@/lib/agency/service";
import { getClientDashboard } from "@/lib/agency/client-dashboard";
import { ClientDashboardView } from "@/components/client-portal/ClientDashboardView";

export const dynamic = "force-dynamic";

export default async function EnterpriseClientDashboardPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/dashboard/enterprise/clients/${clientId}`);

  if (!(await canUseEnterprisePortal())) redirect("/dashboard/enterprise");

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
      backHref="/dashboard/enterprise"
      portalLabel="Enterprise Portal"
      clients={clients}
    />
  );
}
