import { createClient } from "@/lib/supabase/server";
import { getEntitlement } from "@/lib/entitlements";
import DashboardWizard from "./DashboardWizard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const entitlement = await getEntitlement();

  return <DashboardWizard isPremium={entitlement.isPremium} tier={entitlement.tier} isAuthenticated={!!user} />;
}
