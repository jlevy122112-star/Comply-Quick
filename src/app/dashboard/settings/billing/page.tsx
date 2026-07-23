import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrgEntitlement } from "@/lib/entitlements";
import { getScanUsage, getSeatUsage } from "@/lib/billing/usage";
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

  const entitlement = await getOrgEntitlement();
  const config = getTierConfig(entitlement.tier);
  const [scans, seats, clients] = await Promise.all([
    getScanUsage().catch(() => null),
    config.managedClients === null ? Promise.resolve(null) : getSeatUsage().catch(() => null),
    config.managedClients === null ? Promise.resolve(null) : listClients().catch(() => null),
  ]);
  const usage: BillingPageData["usage"] = {
    scans: scans ? { used: scans.used, limit: config.scanLimit, period: scans.period } : null,
    seats:
      config.managedClients === null
        ? { used: 1, limit: config.seats }
        : seats
          ? { used: seats.used, limit: config.seats }
          : null,
    managedClients:
      config.managedClients === null
        ? { status: "not-applicable" }
        : clients
          ? { status: "ok", used: clients.length, limit: config.managedClients }
          : { status: "unavailable" },
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
