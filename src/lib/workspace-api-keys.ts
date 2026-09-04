import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { digestsEqual, hashKey, KEY_PREFIX } from "@/lib/api/keys";

export interface WorkspaceApiKeyRecord {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

interface WorkspaceApiKeyRow {
  id: string;
  organization_id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface ResolvedWorkspaceApiKey {
  keyId: string;
  organizationId: string;
  workspaceId: string;
}

export function mapWorkspaceApiKey(row: Record<string, unknown>): WorkspaceApiKeyRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    keyPrefix: String(row.key_prefix),
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : null,
    revokedAt: row.revoked_at ? String(row.revoked_at) : null,
    createdAt: String(row.created_at),
  };
}

export async function revokeWorkspaceApiKey(workspaceId: string, id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_api_keys")
    .update({ revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", id)
    .is("revoked_at", null);
  return !error;
}

export async function resolveWorkspaceApiKey(key: string): Promise<ResolvedWorkspaceApiKey | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const digest = hashKey(key);
  const admin = createAdminClient();
  const { data } = await admin
    .from("client_api_keys")
    .select("id, organization_id, workspace_id, key_hash, revoked_at")
    .eq("key_hash", digest)
    .maybeSingle();
  const row = data as WorkspaceApiKeyRow | null;
  if (!row || row.revoked_at) return null;
  if (!digestsEqual(row.key_hash, digest)) return null;

  await admin
    .from("client_api_keys")
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", row.id);

  return {
    keyId: row.id,
    organizationId: row.organization_id,
    workspaceId: row.workspace_id,
  };
}
