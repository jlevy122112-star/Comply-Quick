import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPublishedTemplates, getPurchasedTemplateIds, canSell } from "@/lib/marketplace/service";
import MarketplaceView from "./MarketplaceView";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/marketplace");

  const [templates, purchasedIds, seller] = await Promise.all([
    listPublishedTemplates(),
    getPurchasedTemplateIds(),
    canSell(),
  ]);

  return <MarketplaceView templates={templates} purchasedIds={[...purchasedIds]} canSell={seller} />;
}
