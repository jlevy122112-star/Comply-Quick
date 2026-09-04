import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
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
  old_record?: Record<string, unknown>;
}

const EXPECTED_SECRET = process.env.CRON_SECRET;

function extractSource(record: Record<string, unknown> | undefined): PlatformSource {
  const platform = typeof record?.platform === "string" ? record.platform : "";
  if (platform === "webflow") return "webflow";
  if (platform === "wordpress") return "wordpress";
  return "supabase_db";
}

type NativeStatus = "pending" | "active" | "degraded" | "revoked";
const NATIVE_STATUSES = new Set<NativeStatus>(["pending", "active", "degraded", "revoked"]);

function computeEventKey(payload: DbWebhookPayload, record: Record<string, unknown>, fallbackOrgId: string): string {
  const normalized = JSON.stringify({
    schema: payload.schema ?? "public",
    table: payload.table ?? "unknown",
    type: payload.type ?? "UNKNOWN",
    recordId: typeof record.id === "string" ? record.id : null,
    updatedAt: typeof record.updated_at === "string" ? record.updated_at : null,
    organizationId: fallbackOrgId,
    status: typeof record.status === "string" ? record.status : null,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

function desiredStatus(payload: DbWebhookPayload, record: Record<string, unknown>): NativeStatus | null {
  const direct = typeof record.status === "string" ? record.status : null;
  if (direct && NATIVE_STATUSES.has(direct as NativeStatus)) return direct as NativeStatus;

  const next = typeof record.next_status === "string" ? record.next_status : null;
  if (next && NATIVE_STATUSES.has(next as NativeStatus)) return next as NativeStatus;

  if (payload.type === "DELETE") return "revoked";
  if (payload.type === "INSERT") return "pending";
  return null;
}

async function transitionNativeIntegration(admin: ReturnType<typeof createAdminClient>, input: {
  payload: DbWebhookPayload;
  record: Record<string, unknown>;
  organizationId: string;
}): Promise<void> {
  const desired = desiredStatus(input.payload, input.record);
  if (!desired) return;

  const nativeId = typeof input.record.native_integration_id === "string" ? input.record.native_integration_id : null;
  const directId = typeof input.record.id === "string" && input.payload.table === "native_integrations" ? input.record.id : null;
  let targetId = nativeId ?? directId;

  if (!targetId) {
    const platform = typeof input.record.platform === "string" ? input.record.platform : null;
    const externalAccountId =
      typeof input.record.external_account_id === "string" ? input.record.external_account_id : null;
    if (!platform || !externalAccountId) return;
    const { data } = await admin
      .from("native_integrations")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("platform", platform)
      .eq("external_account_id", externalAccountId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetId = (data as { id: string } | null)?.id ?? null;
  }

  if (!targetId) return;

  const patch: Record<string, unknown> = { status: desired, updated_at: new Date().toISOString() };
  if (desired === "active") patch.last_verified_at = new Date().toISOString();
  if (desired === "revoked") patch.disconnected_at = new Date().toISOString();
  if (desired === "degraded") {
    patch.last_error = {
      reason:
        typeof input.record.error === "string"
          ? input.record.error
          : typeof input.record.error_message === "string"
            ? input.record.error_message
            : "platform_event_degraded",
      eventType: input.payload.type ?? "UNKNOWN",
    };
  }

  await admin.from("native_integrations").update(patch).eq("id", targetId);
}

export async function POST(request: Request) {
  try {
    const secret =
      request.headers.get("x-webhook-secret") || request.headers.get("authorization")?.replace("Bearer ", "");
    if (EXPECTED_SECRET && secret !== EXPECTED_SECRET) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 });
    }

    const payload = (await request.json().catch(() => ({}))) as DbWebhookPayload;
    const record = payload.record ?? {};
    const agencyOrgId =
      (typeof record.organization_id === "string" ? record.organization_id : null) ??
      (typeof record.agency_org_id === "string" ? record.agency_org_id : null);
    if (!agencyOrgId) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Missing organization identifier" }), { status: 400 });
    }

    const source = extractSource(record);
    const eventKey = request.headers.get("x-supabase-event-id") || computeEventKey(payload, record, agencyOrgId);
    const admin = createAdminClient();
    const { data, error } = await admin
      .schema("connector")
      .from("platform_webhook_events")
      .upsert(
        {
          agency_org_id: agencyOrgId,
          source,
          event_type: payload.type ?? "UNKNOWN",
          payload: payload as unknown as Record<string, unknown>,
          processed: false,
          event_key: eventKey,
          native_integration_id:
            payload.table === "native_integrations" && typeof record.id === "string" ? record.id : null,
        },
        { onConflict: "event_key", ignoreDuplicates: true }
      )
      .select("id");

    if (error) {
      return new NextResponse(JSON.stringify({ ok: false, error: "Could not log webhook" }), { status: 500 });
    }

    const duplicate = ((data as Array<{ id: string }> | null) ?? []).length === 0;
    if (!duplicate) {
      await transitionNativeIntegration(admin, { payload, record, organizationId: agencyOrgId });
    }

    return new NextResponse(JSON.stringify({ ok: true, duplicate }), { status: 200 });
  } catch (err) {
    return errorResponse(err instanceof Error ? err : new Error(String(err)));
  }
}
