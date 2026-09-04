import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, getMyOrgRole } from "@/lib/organizations-db";
import type { Role } from "@/lib/rbac";

export type NativePlatform = "webflow" | "wordpress";
export type NativeIntegrationStatus = "pending" | "active" | "degraded" | "revoked";
export type NativeIntegrationMode = "propose_only" | "auto";

export interface NativeIntegration {
  id: string;
  organizationId: string;
  workspaceId: string | null;
  clientSeatId: string | null;
  platform: NativePlatform;
  status: NativeIntegrationStatus;
  mode: NativeIntegrationMode;
  externalAccountId: string;
  installMetadata: Record<string, unknown>;
  connectedAt: string;
  disconnectedAt: string | null;
  revokedReason: string | null;
  lastVerifiedAt: string | null;
  lastSyncAt: string | null;
  lastError: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

interface NativeIntegrationRow {
  id: string;
  organization_id: string;
  workspace_id: string | null;
  client_seat_id: string | null;
  platform: NativePlatform;
  status: NativeIntegrationStatus;
  mode: NativeIntegrationMode;
  external_account_id: string;
  install_metadata: Record<string, unknown> | null;
  connected_at: string;
  disconnected_at: string | null;
  revoked_reason: string | null;
  last_verified_at: string | null;
  last_sync_at: string | null;
  last_error: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface PlatformWebhookEventRow {
  id: string;
}

function mapRow(row: NativeIntegrationRow): NativeIntegration {
  return {
    id: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
    clientSeatId: row.client_seat_id,
    platform: row.platform,
    status: row.status,
    mode: row.mode,
    externalAccountId: row.external_account_id,
    installMetadata: row.install_metadata ?? {},
    connectedAt: row.connected_at,
    disconnectedAt: row.disconnected_at,
    revokedReason: row.revoked_reason,
    lastVerifiedAt: row.last_verified_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isNativePlatform(value: string): value is NativePlatform {
  return value === "webflow" || value === "wordpress";
}

function isNativeStatus(value: string): value is NativeIntegrationStatus {
  return value === "pending" || value === "active" || value === "degraded" || value === "revoked";
}

function canManage(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}

function makeEventKey(input: {
  source: string;
  eventType: string;
  organizationId: string;
  nativeIntegrationId?: string | null;
  payload: Record<string, unknown>;
}): string {
  const normalized = JSON.stringify({
    source: input.source,
    eventType: input.eventType,
    organizationId: input.organizationId,
    nativeIntegrationId: input.nativeIntegrationId ?? null,
    payload: input.payload,
  });
  return createHash("sha256").update(normalized).digest("hex");
}

export async function listNativeIntegrations(filters?: {
  organizationId?: string | null;
  workspaceId?: string | null;
  clientSeatId?: string | null;
  platform?: NativePlatform | "all";
  status?: NativeIntegrationStatus | "all";
}): Promise<NativeIntegration[]> {
  const supabase = await createClient();
  const organizationId = filters?.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return [];

  let query = supabase
    .from("native_integrations")
    .select(
      "id, organization_id, workspace_id, client_seat_id, platform, status, mode, external_account_id, install_metadata, connected_at, disconnected_at, revoked_reason, last_verified_at, last_sync_at, last_error, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (filters?.workspaceId) query = query.eq("workspace_id", filters.workspaceId);
  if (filters?.clientSeatId) query = query.eq("client_seat_id", filters.clientSeatId);
  if (filters?.platform && filters.platform !== "all") query = query.eq("platform", filters.platform);
  if (filters?.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as NativeIntegrationRow[]).map(mapRow);
}

export async function connectNativeIntegration(input: {
  organizationId?: string | null;
  workspaceId: string;
  clientSeatId?: string | null;
  platform: NativePlatform;
  externalAccountId: string;
  mode?: NativeIntegrationMode;
  installMetadata?: Record<string, unknown>;
}): Promise<{ ok: true; integration: NativeIntegration } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const organizationId = input.organizationId ?? (await getActiveOrganizationId());
  if (!organizationId) return { ok: false, error: "No active organization." };
  const role = await getMyOrgRole(organizationId);
  if (!canManage(role)) return { ok: false, error: "Only owners and admins can manage native integrations." };
  if (!isNativePlatform(input.platform)) return { ok: false, error: "Unsupported CMS platform." };

  const workspaceId = input.workspaceId.trim();
  const externalAccountId = input.externalAccountId.trim();
  if (!workspaceId) return { ok: false, error: "Workspace is required." };
  if (!externalAccountId) return { ok: false, error: "Site / account identifier is required." };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("native_integrations")
    .upsert(
      {
        organization_id: organizationId,
        workspace_id: workspaceId,
        client_seat_id: input.clientSeatId?.trim() || null,
        platform: input.platform,
        external_account_id: externalAccountId,
        status: "pending",
        disconnected_at: null,
        revoked_reason: null,
        mode: input.mode ?? "propose_only",
        install_metadata: input.installMetadata ?? {},
        created_by: user.id,
        updated_by: user.id,
        connected_at: now,
        updated_at: now,
      },
      { onConflict: "organization_id,workspace_id,platform,external_account_id" }
    )
    .select(
      "id, organization_id, workspace_id, client_seat_id, platform, status, mode, external_account_id, install_metadata, connected_at, disconnected_at, revoked_reason, last_verified_at, last_sync_at, last_error, created_at, updated_at"
    )
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not connect native integration." };
  }
  return { ok: true, integration: mapRow(data as NativeIntegrationRow) };
}

export async function softRevokeNativeIntegration(
  id: string,
  reason?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: row, error: rowError } = await supabase
    .from("native_integrations")
    .select("id, organization_id, platform, external_account_id")
    .eq("id", id)
    .maybeSingle();
  if (rowError || !row) return { ok: false, error: "Integration not found." };

  const role = await getMyOrgRole((row as { organization_id: string }).organization_id);
  if (!canManage(role)) return { ok: false, error: "Only owners and admins can disconnect native integrations." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("native_integrations")
    .update({
      status: "revoked",
      disconnected_at: now,
      revoked_reason: reason?.trim() || "Disconnected by user",
      updated_by: user.id,
      updated_at: now,
    })
    .eq("id", id);
  if (error) return { ok: false, error: "Could not disconnect native integration." };

  await appendPlatformWebhookEvent({
    organizationId: (row as { organization_id: string }).organization_id,
    source: "supabase_db",
    eventType: "native.disconnect",
    nativeIntegrationId: id,
    payload: {
      platform: (row as { platform: string }).platform,
      externalAccountId: (row as { external_account_id: string }).external_account_id,
      revokedReason: reason?.trim() || "Disconnected by user",
      at: now,
    },
  });
  return { ok: true };
}

export async function transitionNativeIntegrationStatus(input: {
  id: string;
  status: NativeIntegrationStatus;
  errorPayload?: Record<string, unknown> | null;
  setVerifiedAt?: boolean;
  setSyncedAt?: boolean;
}): Promise<boolean> {
  if (!isNativeStatus(input.status)) return false;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: input.status,
    updated_at: now,
  };
  if (input.status === "revoked") patch.disconnected_at = now;
  if (input.setVerifiedAt) patch.last_verified_at = now;
  if (input.setSyncedAt) patch.last_sync_at = now;
  if (input.errorPayload !== undefined) patch.last_error = input.errorPayload;
  const { error } = await supabase.from("native_integrations").update(patch).eq("id", input.id);
  return !error;
}

export async function appendPlatformWebhookEvent(input: {
  organizationId: string;
  source: "webflow" | "wordpress" | "supabase_db";
  eventType: string;
  payload: Record<string, unknown>;
  eventKey?: string;
  nativeIntegrationId?: string | null;
}): Promise<{ ok: true; duplicate: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const eventKey =
    input.eventKey ??
    makeEventKey({
      source: input.source,
      eventType: input.eventType,
      organizationId: input.organizationId,
      nativeIntegrationId: input.nativeIntegrationId,
      payload: input.payload,
    });
  const { data, error } = await supabase
    .schema("connector")
    .from("platform_webhook_events")
    .upsert(
      {
        agency_org_id: input.organizationId,
        source: input.source,
        event_type: input.eventType,
        payload: input.payload,
        event_key: eventKey,
        native_integration_id: input.nativeIntegrationId ?? null,
        processed: false,
      },
      { onConflict: "event_key", ignoreDuplicates: true }
    )
    .select("id");
  if (error) return { ok: false, error: "Could not log integration event." };
  const rows = (data as PlatformWebhookEventRow[] | null) ?? [];
  return { ok: true, duplicate: rows.length === 0 };
}
