// SSO connections — server data layer (enterprise).
//
// Per-organization identity-provider configuration. Enforcement is env-gated in
// app code (see ssoEnabled) and no-ops until a real IdP is wired at the Supabase
// Auth layer, mirroring the notification-dispatch pattern. Reads are visible to
// org members; writes require owner/admin (RLS + rbac). `email_domain` routes a
// login to the owning org and is globally unique.

import { createClient } from "@/lib/supabase/server";

export type SsoProtocol = "saml" | "oidc";

export interface SsoConnection {
  id: string;
  organizationId: string;
  protocol: SsoProtocol;
  displayName: string;
  emailDomain: string;
  metadataUrl: string | null;
  enabled: boolean;
  createdAt: string;
}

interface SsoRow {
  id: string;
  organization_id: string;
  protocol: SsoProtocol;
  display_name: string;
  email_domain: string;
  metadata_url: string | null;
  enabled: boolean;
  created_at: string;
}

function mapRow(row: SsoRow): SsoConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    protocol: row.protocol,
    displayName: row.display_name,
    emailDomain: row.email_domain,
    metadataUrl: row.metadata_url,
    enabled: row.enabled,
    createdAt: row.created_at,
  };
}

/** Whether live SSO handoff is configured for this deployment. */
export function ssoEnabled(): boolean {
  return Boolean(process.env.SSO_PROVIDER_URL);
}

function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@/, "");
}

export async function listSsoConnections(orgId: string): Promise<SsoConnection[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sso_connections")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as SsoRow[]).map(mapRow);
}

export async function createSsoConnection(
  orgId: string,
  input: { displayName: string; protocol: SsoProtocol; emailDomain: string; metadataUrl?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const emailDomain = normalizeDomain(input.emailDomain);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(emailDomain)) {
    return { ok: false, error: "Enter a valid email domain (e.g. acme.com)." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("sso_connections").insert({
    organization_id: orgId,
    protocol: input.protocol,
    display_name: input.displayName.trim().slice(0, 120) || "Company SSO",
    email_domain: emailDomain,
    metadata_url: input.metadataUrl?.trim() || null,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "That email domain is already claimed by an SSO connection."
          : "Could not create connection.",
    };
  }
  return { ok: true };
}

export async function setSsoEnabled(id: string, enabled: boolean): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("sso_connections")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteSsoConnection(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("sso_connections").delete().eq("id", id);
  return !error;
}
