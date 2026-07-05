// API key issuance and lookup for the metered public API.
//
// Keys are shown to the user exactly once at creation; only a SHA-256 hash is
// persisted, so a database leak never exposes usable credentials. Verification
// hashes the presented key and matches the digest (constant-time compare).

import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UnauthorizedError, ValidationError } from "@/services/errors";

/** Live-mode secret key prefix. Present in every issued key. */
export const KEY_PREFIX = "cq_live_";

const KEY_COLS = "id, name, key_prefix, last_used_at, revoked_at, created_at";

export interface ApiKeyRecord {
  id: string;
  name: string;
  /** Non-secret display prefix, e.g. "cq_live_9f3a". */
  keyPrefix: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

/** The one-time creation result: the plaintext key plus its stored record. */
export interface IssuedApiKey {
  key: string;
  record: ApiKeyRecord;
}

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

function mapKey(row: KeyRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.key_prefix,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
  };
}

/** SHA-256 hex digest of a full key — the only form persisted. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/** Generates a new opaque secret key: `cq_live_` + 32 random url-safe bytes. */
export function generateKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/** The non-secret display prefix stored alongside the hash (first 12 chars). */
export function keyPrefixOf(key: string): string {
  return key.slice(0, 12);
}

/** Constant-time comparison of two hex digests of equal length. */
export function digestsEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Issues a new API key for the signed-in user. Returns the plaintext key (shown
 * once) and the stored record. The plaintext is never persisted or logged.
 */
export async function createApiKey(name: string): Promise<IssuedApiKey> {
  const label = name.trim().slice(0, 80);
  if (!label) throw new ValidationError("A key name is required.");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const key = generateKey();
  const { data, error } = await supabase
    .from("api_keys")
    .insert({ user_id: user.id, name: label, key_prefix: keyPrefixOf(key), key_hash: hashKey(key) })
    .select(KEY_COLS)
    .single();
  if (error || !data) throw new Error("Could not create API key.");

  return { key, record: mapKey(data as KeyRow) };
}

/** Lists the signed-in user's API keys (most recent first). No secrets. */
export async function listApiKeys(): Promise<ApiKeyRecord[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data, error } = await supabase
    .from("api_keys")
    .select(KEY_COLS)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Could not list API keys.");
  return (data as KeyRow[]).map(mapKey);
}

/** Revokes one of the caller's keys (idempotent). */
export async function revokeApiKey(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error("Could not revoke API key.");
}

export interface ResolvedApiKey {
  keyId: string;
  userId: string;
}

/**
 * Resolves a plaintext key to its owner using the service-role client (the
 * caller has no session). Returns null for unknown or revoked keys. Records
 * last_used_at as a side effect so users can spot stale credentials.
 */
export async function resolveApiKey(key: string): Promise<ResolvedApiKey | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("api_keys")
    .select("id, user_id, key_hash, revoked_at")
    .eq("key_hash", hashKey(key))
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (!digestsEqual(data.key_hash, hashKey(key))) return null;

  await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { keyId: data.id, userId: data.user_id };
}
