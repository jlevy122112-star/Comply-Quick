import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE_MAX = 120;
const UNIQUE_VIOLATION = "23505";

interface ClaimRow {
  id: string;
  email: string;
  token: string;
  source: string;
  claimed_at: string;
  used_at: string | null;
  expires_at: string;
}

export interface FreeScanClaim {
  id: string;
  email: string;
  token: string;
  source: string;
  claimedAt: string;
  usedAt: string | null;
  expiresAt: string;
}

export type FreeScanClaimResult =
  | { status: "issued"; claim: FreeScanClaim }
  | { status: "existing"; claim: FreeScanClaim }
  | { status: "already_used"; claim: FreeScanClaim };

export function normalizeClaimEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidClaimEmail(email: string): boolean {
  return !!email && email.length <= 320 && EMAIL_PATTERN.test(email);
}

export function normalizeClaimSource(value: unknown, fallback = "landing"): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, SOURCE_MAX) : fallback;
}

function mapClaim(row: ClaimRow): FreeScanClaim {
  return {
    id: row.id,
    email: row.email,
    token: row.token,
    source: row.source,
    claimedAt: row.claimed_at,
    usedAt: row.used_at,
    expiresAt: row.expires_at,
  };
}

const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
const CLAIM_COLUMNS = "id,email,token,source,claimed_at,used_at,expires_at";

export async function claimFreeScan(email: string, source: string): Promise<FreeScanClaimResult> {
  const admin = createAdminClient();
  const normalizedEmail = normalizeClaimEmail(email);
  const normalizedSource = normalizeClaimSource(source);
  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS).toISOString();

  const { data: existing } = await admin
    .from("free_scan_claims")
    .select(CLAIM_COLUMNS)
    .eq("email", normalizedEmail)
    .maybeSingle();
  if (existing) {
    const claim = mapClaim(existing as ClaimRow);
    if (claim.usedAt) return { status: "already_used", claim };
    if (new Date(claim.expiresAt).getTime() <= Date.now()) {
      const { data: renewed, error: renewError } = await admin
        .from("free_scan_claims")
        .update({ token: crypto.randomUUID(), expires_at: expiresAt, source: normalizedSource })
        .eq("id", claim.id)
        .is("used_at", null)
        .select(CLAIM_COLUMNS)
        .single();
      if (renewError || !renewed) throw new Error("Could not renew free scan token.");
      return { status: "existing", claim: mapClaim(renewed as ClaimRow) };
    }
    return { status: "existing", claim };
  }

  const { data: inserted, error } = await admin
    .from("free_scan_claims")
    .insert({ email: normalizedEmail, source: normalizedSource, token: crypto.randomUUID(), expires_at: expiresAt })
    .select(CLAIM_COLUMNS)
    .single();

  if (inserted) {
    return { status: "issued", claim: mapClaim(inserted as ClaimRow) };
  }

  if (error?.code === UNIQUE_VIOLATION) {
    const { data: raced } = await admin
      .from("free_scan_claims")
      .select(CLAIM_COLUMNS)
      .eq("email", normalizedEmail)
      .maybeSingle();
    if (raced) {
      const claim = mapClaim(raced as ClaimRow);
      return claim.usedAt ? { status: "already_used", claim } : { status: "existing", claim };
    }
  }

  throw new Error("Could not issue free scan token.");
}

export async function consumeFreeScanToken(token: string): Promise<FreeScanClaim | null> {
  const admin = createAdminClient();
  const usedAt = new Date().toISOString();
  const { data } = await admin
    .from("free_scan_claims")
    .update({ used_at: usedAt })
    .eq("token", token)
    .is("used_at", null)
    .gt("expires_at", usedAt)
    .select(CLAIM_COLUMNS)
    .maybeSingle();
  if (!data) return null;
  return mapClaim(data as ClaimRow);
}

export async function releaseConsumedFreeScan(token: string, usedAt: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("free_scan_claims").update({ used_at: null }).eq("token", token).eq("used_at", usedAt);
}

export async function getFreeScanClaimByToken(token: string): Promise<FreeScanClaim | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("free_scan_claims").select(CLAIM_COLUMNS).eq("token", token).maybeSingle();
  return data ? mapClaim(data as ClaimRow) : null;
}

export async function recordPublicScanEvent(input: {
  claimId: string;
  url: string;
  score: number;
  result: Record<string, unknown>;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("public_scan_events").insert({
    claim_id: input.claimId,
    url: input.url.slice(0, 2048),
    score: input.score,
    result: input.result,
    metadata: { source: "public-scan" },
  });
  if (error) throw new Error("Could not record public scan telemetry.");
}
