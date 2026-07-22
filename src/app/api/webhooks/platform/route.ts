import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/services";

/**
 * Receives Supabase Database Webhook events for the connector platform tables.
 *
 * When an external CMS plugin (Webflow app / WordPress plugin) inserts a row
 * into connector.connector_connections, this endpoint records the event so the
 * continuous-compliance agent can process it asynchronously.
 */

type PlatformSource = "webflow" | "wordpress" | "supabase_db";

interface DbWebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: Record<string, unknown>;
}

const EXPECTED_SECRET = process.env.CRON_SECRET;

function extractSource(record: Record<string, unknown> | undefined): PlatformSource {
  const platform = typeof record?.platform === "string" ? record.platform : "";
  if (platform === "webflow") return "webflow";
  if (platform === "wordpress") return "wordpress";
  return "supabase_db";
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-webhook-secret") || request.headers.get("authorization")?.replace("Bearer ", "");
    if (EXPECTED_SECRET && secret !== EXPECTED_SECRET) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as DbWebhookPayload;
    const record = payload.record ?? {};
    const agencyOrgId = typeof record.agency_org_id === "string" ? record.agency_org_id : null;
    if (!agencyOrgId) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Missing agency_org_id" }), { status: 400 });
    }

    const source = extractSource(record);
    const admin = createAdminClient();
    const { error } = await admin.schema("connector").from("platform_webhook_events").insert({
      agency_org_id: agencyOrgId,
      source,
      event_type: payload.type ?? "UNKNOWN",
      payload: payload as unknown as Record<string, unknown>,
      processed: false,
    });

    if (error) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Could not log webhook" }), { status: 500 });
    }

    return new NextResponse(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
