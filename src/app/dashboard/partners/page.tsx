import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPartnerDashboard, PARTNER_COMMISSION_RATE } from "@/lib/partners/service";
import { getPartnerPayoutStatus, isConnectConfigured } from "@/lib/partners/stripe-connect";
import PartnerView from "./PartnerView";

export const dynamic = "force-dynamic";

export default async function PartnersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/partners");

  const [dashboard, payout] = await Promise.all([getPartnerDashboard(), getPartnerPayoutStatus()]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
            Comply-Quick
          </Link>
          <Link href="/dashboard/home" className="text-sm text-gray-400 hover:text-white">
            &larr; Command Center
          </Link>
        </div>
      </header>
      <PartnerView
        dashboard={dashboard}
        commissionRate={PARTNER_COMMISSION_RATE}
        connected={payout.connected}
        payoutsEnabled={payout.payoutsEnabled}
        connectConfigured={isConnectConfigured()}
      />
    </div>
  );
}
