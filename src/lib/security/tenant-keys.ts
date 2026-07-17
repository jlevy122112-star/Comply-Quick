import { randomBytes } from "node:crypto";
import { getEntitlement } from "@/lib/entitlements";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWithDek, encryptWithDek } from "./envelope";
import { getKeyProvider, getKeyProviderInfo, type KeyProvider } from "./key-provider";

const DEK_BYTES = 32;
const CACHE_TTL_MS = 5 * 60 * 1000;
const KEY_TABLE = "tenant_encryption_keys";

interface TenantKeyRow {
  organization_id: string;
  wrapped_dek: string;
  algorithm: string;
  kek_id: string;
  kek_version: string;
  status: "active" | "retired";
  created_at: string;
  updated_at: string;
  last_rotated_at: string | null;
}

export interface TenantEncryptionStatus {
  enabled: boolean;
  provider: "env" | "kms";
  providerConfigured: boolean;
  keyVersion: string | null;
  lastRotation: string | null;
}

interface CachedDek {
  providerKey: string;
  dek: Buffer;
  expiresAt: number;
}

const dekCache = new Map<string, CachedDek>();

function providerCacheKey(provider: KeyProvider): string {
  return `${provider.id}:${provider.version}`;
}

function mapRow(row: TenantKeyRow): TenantEncryptionStatus {
  return {
    enabled: row.status === "active",
    provider: row.kek_id === "kms" ? "kms" : "env",
    providerConfigured: getKeyProviderInfo().configured,
    keyVersion: row.kek_version,
    lastRotation: row.last_rotated_at ?? row.updated_at ?? row.created_at,
  };
}

async function getActiveRow(orgId: string): Promise<TenantKeyRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(KEY_TABLE)
    .select(
      "organization_id, wrapped_dek, algorithm, kek_id, kek_version, status, created_at, updated_at, last_rotated_at"
    )
    .eq("organization_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(`Could not read tenant encryption key: ${error.message}`);
  return (data as TenantKeyRow | null) ?? null;
}

async function createTenantKey(orgId: string, provider: KeyProvider): Promise<TenantKeyRow> {
  const dek = randomBytes(DEK_BYTES);
  const wrappedDek = await provider.wrapDek(dek);
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(KEY_TABLE)
    .insert({
      organization_id: orgId,
      wrapped_dek: wrappedDek,
      algorithm: "AES-256-GCM",
      kek_id: provider.id,
      kek_version: provider.version,
      status: "active",
      created_at: now,
      updated_at: now,
    })
    .select(
      "organization_id, wrapped_dek, algorithm, kek_id, kek_version, status, created_at, updated_at, last_rotated_at"
    )
    .single();
  if (!error && data) return data as TenantKeyRow;

  // A concurrent first request may have won the unique organization_id insert.
  const existing = await getActiveRow(orgId);
  if (existing) return existing;
  throw new Error(`Could not create tenant encryption key: ${error?.message ?? "unknown error"}`);
}

async function getDek(orgId: string, provider: KeyProvider, { create }: { create: boolean }): Promise<Buffer> {
  const cacheKey = providerCacheKey(provider);
  const cached = dekCache.get(orgId);
  if (cached && cached.providerKey === cacheKey && cached.expiresAt > Date.now()) return cached.dek;

  let row = await getActiveRow(orgId);
  if (!row) {
    if (!create) throw new Error("No tenant encryption key exists for this organization.");
    row = await createTenantKey(orgId, provider);
  }
  const dek = await provider.unwrapDek(row.wrapped_dek);
  if (dek.length !== DEK_BYTES) throw new Error("Unwrapped tenant DEK has an invalid length.");
  dekCache.set(orgId, { providerKey: cacheKey, dek, expiresAt: Date.now() + CACHE_TTL_MS });
  return dek;
}

function clearTenantKeyCache(orgId: string): void {
  dekCache.delete(orgId);
}

export async function getTenantEncryptionStatus(orgId: string): Promise<TenantEncryptionStatus> {
  const row = await getActiveRow(orgId);
  if (row) return mapRow(row);
  const provider = getKeyProviderInfo();
  return {
    enabled: false,
    provider: provider.id,
    providerConfigured: provider.configured,
    keyVersion: provider.configured ? provider.version : null,
    lastRotation: null,
  };
}

/** Creates the initial key or re-wraps the existing DEK with the active KEK. */
export async function rotateTenantKey(orgId: string): Promise<TenantEncryptionStatus> {
  const provider = getKeyProvider();
  const existing = await getActiveRow(orgId);
  if (!existing) {
    const created = await createTenantKey(orgId, provider);
    clearTenantKeyCache(orgId);
    return mapRow(created);
  }

  const dek = await provider.unwrapDek(existing.wrapped_dek);
  const wrappedDek = await provider.wrapDek(dek);
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from(KEY_TABLE)
    .update({
      wrapped_dek: wrappedDek,
      kek_id: provider.id,
      kek_version: provider.version,
      updated_at: now,
      last_rotated_at: now,
    })
    .eq("organization_id", orgId)
    .eq("status", "active")
    .select(
      "organization_id, wrapped_dek, algorithm, kek_id, kek_version, status, created_at, updated_at, last_rotated_at"
    )
    .single();
  if (error || !data) throw new Error(`Could not rotate tenant encryption key: ${error?.message ?? "unknown error"}`);
  clearTenantKeyCache(orgId);
  return mapRow(data as TenantKeyRow);
}

async function requireEnterprise(): Promise<void> {
  const entitlement = await getEntitlement();
  if (!entitlement.isEnterprise) {
    throw new Error("Field-level encryption requires an active Enterprise subscription.");
  }
}

export async function encryptField(orgId: string, plaintext: string): Promise<string> {
  await requireEnterprise();
  const provider = getKeyProvider();
  const dek = await getDek(orgId, provider, { create: true });
  return encryptWithDek(orgId, plaintext, dek);
}

export async function decryptField(orgId: string, payload: string): Promise<string> {
  await requireEnterprise();
  const provider = getKeyProvider();
  const dek = await getDek(orgId, provider, { create: false });
  return decryptWithDek(orgId, payload, dek);
}

export function clearTenantEncryptionCache(orgId?: string): void {
  if (orgId) {
    clearTenantKeyCache(orgId);
    return;
  }
  dekCache.clear();
}
