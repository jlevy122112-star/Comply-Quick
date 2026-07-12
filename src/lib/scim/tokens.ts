// SCIM bearer-token issuance and lookup (enterprise provisioning).
//
// Each organization can issue bearer tokens that its identity provider presents
// on every SCIM request. Tokens are shown to the admin exactly once at creation;
// only a SHA-256 hash is persisted, so a database leak never exposes usable
// credentials. Resolution hashes the presented token and matches the digest with
// a constant-time compare, then records last_used_at.

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Prefix present on every issued SCIM token. */
export const SCIM_TOKEN_PREFIX = "scim_";

/**
 * Whether SCIM provisioning can operate on this deployment. The endpoints use
 * the service-role client to read tokens and write the directory without a user
 * session, so a configured service-role key is the prerequisite.
 */
export function scimEnabled(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const TOKEN_COLS = "id, name, token_prefix, last_used_at, revoked_at, created_at";

export interface ScimTokenRecord {
  id: string;
  name: string;
  /** Non-secret display prefix, e.g. "scim_9f3a". */
  tokenPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** One-time creation result: the plaintext token plus its stored record. */
export interface IssuedScimToken {
  token: string;
  record: ScimTokenRecord;
}

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function mapToken(row: TokenRow): ScimTokenRecord {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** SHA-256 hex digest of a token — the only form persisted. */
export function hashScimToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generates a new opaque token: `scim_` + 32 random url-safe bytes. */
export function generateScimToken(): string {
  return `${SCIM_TOKEN_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** The non-secret display prefix stored alongside the hash (first 12 chars). */
export function scimTokenPrefixOf(token: string): string {
  return token.slice(0, 12);
}

/** Constant-time comparison of two equal-length hex digests. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Lists an org's SCIM tokens (most recent first). Never returns secrets. */
export async function listScimTokens(orgId: string): Promise<ScimTokenRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scim_tokens")
    .select(TOKEN_COLS)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as TokenRow[]).map(mapToken);
}

/**
 * Issues a new SCIM token for an org. Returns the plaintext token (shown once)
 * and the stored record. The plaintext is never persisted or logged.
 */
export async function createScimToken(orgId: string, name: string): Promise<IssuedScimToken> {
  const label = name.trim().slice(0, 80) || "SCIM token";
  const token = generateScimToken();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scim_tokens")
    .insert({
      organization_id: orgId,
      name: label,
      token_prefix: scimTokenPrefixOf(token),
      token_hash: hashScimToken(token),
    })
    .select(TOKEN_COLS)
    .single();
  if (error || !data) throw new Error("Could not create SCIM token.");
  return { token, record: mapToken(data as TokenRow) };
}

/** Revokes one of the org's tokens (idempotent, RLS-scoped to admins). */
export async function revokeScimToken(orgId: string, id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("scim_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("organization_id", orgId);
  return !error;
}

export interface ResolvedScimToken {
  tokenId: string;
  organizationId: string;
}

/**
 * Resolves a plaintext bearer token to its organization using the service-role
 * client (the IdP has no user session). Returns null for unknown or revoked
 * tokens. Records last_used_at as a side effect.
 */
export async function resolveScimToken(token: string): Promise<ResolvedScimToken | null> {
  if (!token.startsWith(SCIM_TOKEN_PREFIX)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("scim_tokens")
    .select("id, organization_id, token_hash, revoked_at")
    .eq("token_hash", hashScimToken(token))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (!digestsEqual(data.token_hash, hashScimToken(token))) return null;

  await admin.from("scim_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { tokenId: data.id, organizationId: data.organization_id };
}
