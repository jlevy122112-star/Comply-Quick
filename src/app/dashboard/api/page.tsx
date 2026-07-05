import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listApiKeys } from "@/lib/api/keys";
import { getApiUsageSummary, hasApiAccess } from "@/lib/api/usage";
import { getEntitlement } from "@/lib/entitlements";
import ApiView from "./ApiView";

export const dynamic = "force-dynamic";

export default async function ApiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/api");

  const canUseApi = await hasApiAccess();
  const [keys, usage, { tier }] = await Promise.all([
    canUseApi ? listApiKeys() : Promise.resolve([]),
    canUseApi ? getApiUsageSummary() : Promise.resolve(null),
    getEntitlement(),
  ]);

  return <ApiView tier={tier} canUseApi={canUseApi} initialKeys={keys} usage={usage} />;
}
