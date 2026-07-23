import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgEntitlement } from "@/lib/entitlements";
import { getBillingSummary } from "@/lib/billing/usage";
import { listClients } from "@/lib/agency/service";
import { getTierConfig, type Tier } from "@/lib/pricing";
import { AppShell } from "@/components/dashboard/AppShell";
import PlansBillingView, { type BillingPageData } from "./PlansBillingView";

export const dynamic = "force-dynamic";

export default async function PlansBillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/dashboard/settings/billing");

  const [entitlement, billing, clients] = await Promise.all([
    getOrgEntitlement(),
    getBillingSummary().catch(() => null),
    listClients().catch(() => []),
  ]);
  const config = getTierConfig(entitlement.tier);
  const usage: BillingPageData["usage"] = {
    scans: billing?.scans ? { used: billing.scans.used, limit: config.scanLimit, period: billing.scans.period } : null,
    seats: billing?.seats ? { used: billing.seats.used, limit: config.seats } : null,
    managedClients: { used: clients.length, limit: config.managedClients },
    error: billing === null,
  };

  return (
    <AppShell tier={entitlement.tier} userEmail={user.email ?? null}>
      <PlansBillingView
        tier={entitlement.tier}
        status={entitlement.status}
        currentPeriodEnd={entitlement.currentPeriodEnd}
        usage={usage}
      />
    </AppShell>
  );
}

export type { Tier };
