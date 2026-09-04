import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceApiKey } from "@/lib/workspace-api-keys";
import { errorResponse } from "@/services";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const key = typeof body.key === "string" ? body.key : "";
    if (!key) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Missing key" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const resolved = await resolveWorkspaceApiKey(key);
    if (!resolved) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Invalid or revoked key" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const url = typeof body.url === "string" ? body.url.slice(0, 2048) : "";
    if (!url) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Missing url" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("compliance_agent_events").insert({
      organization_id: resolved.organizationId,
      workspace_id: resolved.workspaceId,
      client_api_key_id: resolved.keyId,
      url,
      title: typeof body.title === "string" ? body.title.slice(0, 500) : null,
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 2048) : null,
      metadata: {
        t: typeof body.t === "number" ? body.t : Date.now(),
        w: typeof body.w === "number" ? body.w : null,
        h: typeof body.h === "number" ? body.h : null,
        path: typeof body.path === "string" ? body.path.slice(0, 500) : null,
        host: typeof body.host === "string" ? body.host.slice(0, 255) : null,
        origin: typeof body.origin === "string" ? body.origin.slice(0, 255) : null,
        source: "compliance-agent",
        userAgent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      },
    });

    if (error) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Could not record event" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new NextResponse(JSON.stringify({ ok: true, workspaceId: resolved.workspaceId }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
