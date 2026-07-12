// SCIM provisioning data layer (enterprise). Persists the IdP-managed directory
// into `scim_users` and reconciles active state with `organization_members`.
//
// The SCIM endpoints authenticate by bearer token (no user session), so this
// layer uses the service-role client and always scopes every query by the token
// owner's `organizationId`. Reconciliation is best-effort and never touches the
// org owner: provisioning links an *existing* Comply-Quick account as a member,
// and deprovisioning removes that membership — we never create or delete auth
// users, matching the existing invite-by-email flow.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ScimUserInput, ScimUserResource } from "./schema";

interface ScimUserRow {
  id: string;
  organization_id: string;
  external_id: string | null;
  user_name: string;
  email: string | null;
  display_name: string | null;
  given_name: string | null;
  family_name: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const USER_COLS =
  "id, organization_id, external_id, user_name, email, display_name, given_name, family_name, active, created_at, updated_at";

function mapUser(row: ScimUserRow): ScimUserResource {
  return {
    id: row.id,
    externalId: row.external_id,
    userName: row.user_name,
    email: row.email,
    displayName: row.display_name,
    givenName: row.given_name,
    familyName: row.family_name,
    active: row.active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listScimUsers(
  orgId: string,
  opts: { userName?: string | null; offset?: number; limit?: number } = {}
): Promise<{ users: ScimUserResource[]; total: number }> {
  const admin = createAdminClient();
  const offset = opts.offset ?? 0;
  const limit = opts.limit ?? 100;

  // SCIM count=0 is a valid "total only" request — return no rows but the real total.
  if (limit === 0) {
    let head = admin.from("scim_users").select("id", { count: "exact", head: true }).eq("organization_id", orgId);
    if (opts.userName) head = head.eq("user_name", opts.userName);
    const { count } = await head;
    return { users: [], total: count ?? 0 };
  }

  let query = admin
    .from("scim_users")
    .select(USER_COLS, { count: "exact" })
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (opts.userName) query = query.eq("user_name", opts.userName);
  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error || !data) return { users: [], total: 0 };
  return { users: (data as ScimUserRow[]).map(mapUser), total: count ?? 0 };
}

export async function getScimUser(orgId: string, id: string): Promise<ScimUserResource | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scim_users")
    .select(USER_COLS)
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  return data ? mapUser(data as ScimUserRow) : null;
}

export type WriteResult = { ok: true; user: ScimUserResource } | { ok: false; conflict?: boolean; error: string };

export async function createScimUser(orgId: string, input: ScimUserInput): Promise<WriteResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scim_users")
    .insert({
      organization_id: orgId,
      external_id: input.externalId,
      user_name: input.userName,
      email: input.email,
      display_name: input.displayName,
      given_name: input.givenName,
      family_name: input.familyName,
      active: input.active,
      raw: input as unknown as Record<string, unknown>,
    })
    .select(USER_COLS)
    .single();
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, conflict: true, error: "userName already exists." };
    return { ok: false, error: "Could not create user." };
  }
  const user = mapUser(data as ScimUserRow);
  await reconcileMembership(orgId, user.email, user.active);
  return { ok: true, user };
}

export async function replaceScimUser(orgId: string, id: string, input: ScimUserInput): Promise<WriteResult> {
  const admin = createAdminClient();
  const { data: prior } = await admin
    .from("scim_users")
    .select("email")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  const { data, error } = await admin
    .from("scim_users")
    .update({
      external_id: input.externalId,
      user_name: input.userName,
      email: input.email,
      display_name: input.displayName,
      given_name: input.givenName,
      family_name: input.familyName,
      active: input.active,
      raw: input as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("id", id)
    .select(USER_COLS)
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return { ok: false, conflict: true, error: "userName already exists." };
    return { ok: false, error: "Could not update user." };
  }
  if (!data) return { ok: false, error: "User not found." };
  const user = mapUser(data as ScimUserRow);
  const oldEmail = (prior as { email: string | null } | null)?.email ?? null;
  if (oldEmail && oldEmail.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    await reconcileMembership(orgId, oldEmail, false);
  }
  await reconcileMembership(orgId, user.email, user.active);
  return { ok: true, user };
}

/** Sets a user's active flag (the SCIM deprovisioning path). */
export async function setScimUserActive(orgId: string, id: string, active: boolean): Promise<WriteResult> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scim_users")
    .update({ active, updated_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("id", id)
    .select(USER_COLS)
    .maybeSingle();
  if (error) return { ok: false, error: "Could not update user." };
  if (!data) return { ok: false, error: "User not found." };
  const user = mapUser(data as ScimUserRow);
  await reconcileMembership(orgId, user.email, user.active);
  return { ok: true, user };
}

export type DeleteResult = "deleted" | "not_found" | "error";

/** Hard-deletes a provisioned user and revokes any linked membership. */
export async function deleteScimUser(orgId: string, id: string): Promise<DeleteResult> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("scim_users")
    .select("email")
    .eq("organization_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (!data) return "not_found";

  const { error } = await admin.from("scim_users").delete().eq("organization_id", orgId).eq("id", id);
  if (error) return "error";
  if (data.email) await reconcileMembership(orgId, data.email as string, false);
  return "deleted";
}

/**
 * Resolves an email to an existing Comply-Quick account id via the admin
 * listing, or null when no account uses it yet. Bounded paging (SCIM directories
 * are small relative to the full user base).
 */
async function findUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const match = data?.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (!data || data.users.length < 200) break;
  }
  return null;
}

/**
 * Best-effort membership reconciliation. When a provisioned user is active and a
 * matching account exists, ensure an `organization_members` row (default role
 * `member`); when deactivated/removed, drop that row. The org owner is never
 * demoted or removed. Failures are swallowed — SCIM's authoritative record is
 * `scim_users`; membership is a convenience projection.
 */
export async function reconcileMembership(orgId: string, email: string | null, active: boolean): Promise<void> {
  if (!email) return;
  const userId = await findUserIdByEmail(email);
  if (!userId) return;

  const admin = createAdminClient();
  const { data: org } = await admin.from("organizations").select("owner_id").eq("id", orgId).maybeSingle();
  if ((org as { owner_id: string } | null)?.owner_id === userId) return; // never touch the owner

  if (active) {
    await admin
      .from("organization_members")
      .upsert(
        { organization_id: orgId, user_id: userId, role: "member" },
        { onConflict: "organization_id,user_id", ignoreDuplicates: true }
      );
  } else {
    await admin.from("organization_members").delete().eq("organization_id", orgId).eq("user_id", userId);
  }
}
