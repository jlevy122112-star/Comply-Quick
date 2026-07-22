import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organizations-db";
import { getGitHubConnection, getReposForConnection } from "@/lib/github/service";
import { errorResponse } from "@/services";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });

    const organizationId = await getActiveOrganizationId();
    if (!organizationId) return NextResponse.json({ ok: false, error: "Select an organization" }, { status: 400 });

    const connection = await getGitHubConnection(organizationId);
    if (!connection) return NextResponse.json({ ok: false, connected: false, repos: [] });

    const repos = await getReposForConnection(connection);
    return NextResponse.json({ ok: true, connected: true, repos });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
