// Public score pages — publish / revoke / read service (Phase 4 / [Up4]).
//
// Publishing snapshots a scan's score into `published_scores` under an
// unguessable slug. The public page + badge read that snapshot (never the live
// scan), so a shared score stays stable and is revocable.

import { randomBytes } from "node:crypto";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { UnauthorizedError, NotFoundError } from "@/services/errors";
import { recordAuditLog } from "@/lib/audit-log";

export interface PublishedScore {
  id: string;
  slug: string;
  url: string;
  label: string | null;
  score: number;
  createdAt: string;
}

/** White-label branding resolved from the publishing user's agency, if any. */
export interface PublicScoreBrand {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
}

export interface PublicScore {
  slug: string;
  url: string;
  label: string | null;
  score: number;
  createdAt: string;
  /** Agency branding when the publisher owns or is a member of an agency. */
  brand: PublicScoreBrand | null;
}

/** Unguessable URL-safe public identifier (~12 chars of base64url entropy). */
function generateSlug(): string {
  return randomBytes(9).toString("base64url");
}

function mapRow(row: {
  id: string;
  slug: string;
  url: string;
  label: string | null;
  score: number;
  created_at: string;
}): PublishedScore {
  return { id: row.id, slug: row.slug, url: row.url, label: row.label, score: row.score, createdAt: row.created_at };
}

/**
 * Publishes (or returns the existing live page for) one of the caller's scans.
 * Idempotent per scan: a scan already published live is returned unchanged.
 */
export async function publishScore(scanId: string, label?: string): Promise<PublishedScore> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data: scan } = await supabase
    .from("scans")
    .select("id, url, score")
    .eq("id", scanId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!scan) throw new NotFoundError("Scan not found.");
  if (scan.score === null) throw new NotFoundError("This scan has no score to publish.");

  const { data: existing } = await supabase
    .from("published_scores")
    .select("id, slug, url, label, score, created_at")
    .eq("scan_id", scanId)
    .is("revoked_at", null)
    .maybeSingle();
  if (existing) return mapRow(existing);

  const { data, error } = await supabase
    .from("published_scores")
    .insert({
      user_id: user.id,
      scan_id: scanId,
      slug: generateSlug(),
      url: scan.url,
      label: label?.trim() || null,
      score: scan.score,
    })
    .select("id, slug, url, label, score, created_at")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to publish score.");

  await recordAuditLog({
    action: "score.published",
    entityType: "scan",
    entityId: scanId,
    summary: `Published a public compliance score (${scan.score}) for ${scan.url}.`,
    metadata: { slug: data.slug, score: scan.score },
  });
  return mapRow(data);
}

/** Revokes a published score the caller owns (soft delete). */
export async function revokeScore(id: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  await supabase
    .from("published_scores")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null);

  await recordAuditLog({
    action: "score.revoked",
    entityType: "published_score",
    entityId: id,
    summary: "Revoked a public compliance score page.",
  });
}

/** Lists the caller's live published scores (most recent first). */
export async function listPublishedScores(): Promise<PublishedScore[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("published_scores")
    .select("id, slug, url, label, score, created_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map(mapRow);
}

/**
 * Resolves the white-label brand for a publishing user. Checks agency
 * ownership first, then team membership (agency_members), so a score published
 * by any member of an agency carries that agency's branding. Returns null when
 * the user isn't attached to any agency (→ Comply-Quick branding).
 */
async function resolveAgencyBrand(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<PublicScoreBrand | null> {
  const { data: owned } = await admin
    .from("agencies")
    .select("name, logo_url, primary_color")
    .eq("owner_id", userId)
    .maybeSingle();

  let agency = owned;
  if (!agency) {
    const { data: membership } = await admin
      .from("agency_members")
      .select("agencies ( name, logo_url, primary_color )")
      .eq("user_id", userId)
      // Deterministic when a user belongs to more than one agency: oldest first.
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const joined = membership?.agencies;
    agency = Array.isArray(joined) ? (joined[0] ?? null) : (joined ?? null);
  }

  if (!agency) return null;
  return { name: agency.name, logoUrl: agency.logo_url ?? null, primaryColor: agency.primary_color };
}

async function resolveOrganizationBrand(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<PublicScoreBrand | null> {
  const { data: owned } = await admin
    .from("organizations")
    .select("name, logo_url, primary_color")
    .eq("owner_id", userId)
    .eq("is_personal", true)
    .maybeSingle();

  if (owned) {
    return { name: owned.name, logoUrl: owned.logo_url ?? null, primaryColor: owned.primary_color };
  }

  const { data: membership } = await admin
    .from("organization_members")
    .select("organizations ( name, logo_url, primary_color )")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const joined = membership?.organizations;
  const org = Array.isArray(joined) ? (joined[0] ?? null) : (joined ?? null);
  if (!org) return null;
  return { name: org.name, logoUrl: org.logo_url ?? null, primaryColor: org.primary_color };
}

/**
 * Reads a live public score by slug for the anonymous public page / badge.
 * Uses the service-role client so it works without a session; returns null for
 * unknown or revoked slugs.
 *
 * Wrapped in React `cache()` so a single request that reads it more than once
 * (e.g. `generateMetadata` + the page body) shares one set of DB queries.
 */
export const getPublicScore = cache(async (slug: string): Promise<PublicScore | null> => {
  const admin = createAdminClient();
  const { data } = await admin
    .from("published_scores")
    .select("user_id, slug, url, label, score, created_at, revoked_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!data || data.revoked_at) return null;

  // Resolve white-label branding: agency workspace branding takes precedence;
  // otherwise use the publishing user's organization branding. Falls back to null
  // (Comply-Quick branding) when neither is configured.
  const brand = (await resolveAgencyBrand(admin, data.user_id)) ?? (await resolveOrganizationBrand(admin, data.user_id));

  return {
    slug: data.slug,
    url: data.url,
    label: data.label,
    score: data.score,
    createdAt: data.created_at,
    brand,
  };
});
