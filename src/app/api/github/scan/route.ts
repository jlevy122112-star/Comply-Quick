import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organizations-db";
import { enqueueGitHubScan, getGitHubConnection } from "@/lib/github/service";
import { errorResponse } from "@/services";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
    }

    const organizationId = await getActiveOrganizationId();
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "Select an organization" }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const repoFullName = typeof body.repoFullName === "string" ? body.repoFullName.trim() : "";
    if (!repoFullName || !/^[^/]+\/[^/]+$/.test(repoFullName)) {
      return NextResponse.json({ ok: false, error: "Invalid repo format. Use owner/repo." }, { status: 400 });
    }

    const connection = await getGitHubConnection(organizationId);
    if (!connection) {
      return NextResponse.json({ ok: false, error: "GitHub App not installed" }, { status: 400 });
    }

    const queued = await enqueueGitHubScan({
      connectionId: connection.id,
      installationId: connection.installationId,
      repoFullName,
      enqueueSource: "manual",
      createdBy: user.id,
    });
    return NextResponse.json({
      ok: true,
      queued,
      message: queued.duplicate ? "Scan already queued for this revision." : "Scan queued.",
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
