import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organizations-db";
import { buildAuthorizeUrl } from "@/lib/github/oauth";
import { signState } from "@/lib/github/state";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/dashboard/tools/github");

  const organizationId = await getActiveOrganizationId();
  if (!organizationId) redirect("/dashboard/tools/github?error=no_org");

  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/github/callback`;
  const secret = process.env.CRON_SECRET;
  if (!clientId || !secret) redirect("/dashboard/tools/github?error=not_configured");

  const state = signState(secret, organizationId);
  const url = buildAuthorizeUrl({ clientId, clientSecret: "", redirectUri }, state);
  redirect(url);
}
