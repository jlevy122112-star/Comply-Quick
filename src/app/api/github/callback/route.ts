import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeCodeForToken } from "@/lib/github/oauth";
import { verifyState } from "@/lib/github/state";
import { encryptToken } from "@/lib/connector/crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const redirectBase = "/dashboard/tools/github";

  if (error || !code || !state) {
    redirect(`${redirectBase}?error=${error ?? "invalid_request"}`);
  }

  const secret = process.env.CRON_SECRET;
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret || !clientId || !clientSecret) {
    redirect(`${redirectBase}?error=not_configured`);
  }

  const organizationId = verifyState(secret, state);
  if (!organizationId) {
    redirect(`${redirectBase}?error=invalid_state`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${redirectBase}`);

  try {
    const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/github/callback`;
    const token = await exchangeCodeForToken(code, { clientId, clientSecret, redirectUri });

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token.accessToken}`, Accept: "application/vnd.github+json" },
    });
    const userJson = (await userRes.json().catch(() => ({}))) as { login?: string };
    const externalAccountId = userJson.login ?? "unknown";

    const admin = createAdminClient();
    await admin.schema("connector").from("connector_connections").upsert(
      {
        agency_org_id: organizationId,
        platform: "github",
        external_account_id: externalAccountId,
        status: "active",
        mode: "propose_only",
        scopes: token.scope.split(/,\s*|\s+/).filter(Boolean),
        access_token_enc: encryptToken(token.accessToken),
        last_verified_at: new Date().toISOString(),
      },
      { onConflict: "platform,external_account_id" }
    );

    redirect(`${redirectBase}?success=connected`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    redirect(`${redirectBase}?error=${encodeURIComponent(message)}`);
  }
}
