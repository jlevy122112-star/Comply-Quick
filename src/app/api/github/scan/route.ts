import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organizations-db";
import { getGitHubConnection, scanAndStoreFindings } from "@/lib/github/service";
import { errorResponse } from "@/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Sign in required" }), { status: 401 });
    }

    const organizationId = await getActiveOrganizationId();
    if (!organizationId) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Select an organization" }), { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const repoFullName = typeof body.repoFullName === "string" ? body.repoFullName : "";
    if (!repoFullName || !/^[^/]+\/[^/]+$/.test(repoFullName)) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Invalid repo format. Use owner/repo." }), {
        status: 400,
      });
    }

    const connection = await getGitHubConnection(organizationId);
    if (!connection) {
      return new NextResponse(JSON.stringify({ ok: false, error: "GitHub not connected" }), { status: 400 });
    }

    const result = await scanAndStoreFindings(connection, repoFullName);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
