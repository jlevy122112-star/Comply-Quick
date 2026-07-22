import { NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/api/keys";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/services";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Ingests a pixel telemetry event.
 */
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

    const resolved = await resolveApiKey(key);
    if (!resolved) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Invalid or revoked key" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("pixel_events").insert({
      api_key_id: resolved.keyId,
      user_id: resolved.userId,
      url: String(body.url ?? "").slice(0, 2048),
      title: typeof body.title === "string" ? body.title.slice(0, 500) : null,
      referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 2048) : null,
      metadata: {
        t: typeof body.t === "number" ? body.t : Date.now(),
        w: typeof body.w === "number" ? body.w : null,
        h: typeof body.h === "number" ? body.h : null,
      },
    });

    if (error) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Could not record event" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}
