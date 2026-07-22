// CMS plugin platform connections — Webflow app + WordPress plugin.
//
// Lets agency owners register or view native platform integrations that live in
// the connector schema. These connections are the trigger for the continuous
// compliance agent and for the inbound webhook handler at /api/webhooks/platform.

import { createClient } from "@/lib/supabase/server";

export type CmsPlatform = "webflow" | "wordpress";

export interface CmsConnection {
  id: string;
  agencyOrgId: string;
  platform: CmsPlatform;
  externalAccountId: string;
  status: string;
  mode: string;
  createdAt: string;
  lastVerifiedAt?: string | null;
}

interface ConnectionRow {
  id: string;
  agency_org_id: string;
  platform: string;
  external_account_id: string;
  status: string;
  mode: string;
  created_at: string;
  last_verified_at: string | null;
}

function mapRow(row: ConnectionRow): CmsConnection {
  return {
    id: row.id,
    agencyOrgId: row.agency_org_id,
    platform: row.platform as CmsPlatform,
    externalAccountId: row.external_account_id,
    status: row.status,
    mode: row.mode,
    createdAt: row.created_at,
    lastVerifiedAt: row.last_verified_at,
  };
}

const CMS_PLATFORMS: CmsPlatform[] = ["webflow", "wordpress"];

/**
 * Lists the CMS plugin connections for an organization.
 * RLS enforces that the caller is a member of the organization.
 */
export async function listCmsConnections(organizationId: string): Promise<CmsConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("connector")
    .from("connector_connections")
    .select("id, agency_org_id, platform, external_account_id, status, mode, created_at, last_verified_at")
    .eq("agency_org_id", organizationId)
    .in("platform", CMS_PLATFORMS)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as ConnectionRow[]).map(mapRow);
}

/**
 * Registers a manual CMS connection (used when a plugin cannot OAuth by itself
 * or when an agency owner records the site manually).
 * RLS enforces that the caller is an org admin.
 */
export async function createCmsConnection(input: {
  organizationId: string;
  platform: CmsPlatform;
  externalAccountId: string;
}): Promise<{ ok: true; connection: CmsConnection } | { ok: false; error: string }> {
  const platform = input.platform;
  const externalAccountId = input.externalAccountId.trim();
  if (!externalAccountId) return { ok: false, error: "Site / account identifier is required." };
  if (!CMS_PLATFORMS.includes(platform)) return { ok: false, error: "Unsupported CMS platform." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("connector")
    .from("connector_connections")
    .insert({
      agency_org_id: input.organizationId,
      platform,
      external_account_id: externalAccountId,
    })
    .select("id, agency_org_id, platform, external_account_id, status, mode, created_at, last_verified_at")
    .single();
  if (error || !data) return { ok: false, error: "Could not create connection." };
  return { ok: true, connection: mapRow(data as ConnectionRow) };
}
