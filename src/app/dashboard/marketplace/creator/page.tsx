import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  canSell,
  getMyCreator,
  listMyTemplates,
  getCreatorEarnings,
  getMarketplaceRevenue,
  isPlatformAdmin,
} from "@/lib/marketplace/service";
import type { MarketplaceRevenue } from "@/lib/marketplace/shared";
import { getPayoutStatus, isConnectConfigured } from "@/lib/marketplace/stripe-connect";
import { UpsellCta } from "@/components/ui";
import CreatorView from "./CreatorView";

export const dynamic = "force-dynamic";

export default async function CreatorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/marketplace/creator");

  if (!(await canSell())) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="border-b border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/dashboard/home" className="text-lg font-bold text-white tracking-tight">
              Comply-Quick
            </Link>
            <Link href="/dashboard/marketplace" className="text-sm text-gray-400 hover:text-white">
              &larr; Marketplace
            </Link>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <p className="text-4xl mb-4">🛍️</p>
          <h1 className="text-2xl font-bold text-white mb-2">Become a Seller</h1>
          <p className="text-gray-400 mb-6">
            Publishing and selling compliance templates is available on any paid plan. Upgrade to start earning on every
            sale.
          </p>
          <div className="mx-auto max-w-sm text-left">
            <UpsellCta
              tier="free"
              title="Unlock creator selling"
              benefit="Publish and sell compliance templates on any paid plan."
            />
          </div>
        </main>
      </div>
    );
  }

  // Ensure a creator profile exists is deferred to first action; just read state.
  const [creator, templates, payout, earnings, admin] = await Promise.all([
    getMyCreator(),
    listMyTemplates(),
    getPayoutStatus(),
    getCreatorEarnings(),
    isPlatformAdmin(),
  ]);
  let revenue: MarketplaceRevenue | null = null;
  if (admin) revenue = await getMarketplaceRevenue();

  return (
    <CreatorView
      creator={creator}
      templates={templates}
      payoutsEnabled={payout.payoutsEnabled}
      connected={payout.connected}
      connectConfigured={isConnectConfigured()}
      earnings={earnings}
      revenue={revenue}
    />
  );
}
