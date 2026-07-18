// Organizations — server data layer (enterprise multi-tenancy).
//
// The top of the tenant hierarchy: organization → workspace → project. A user
// owns one personal organization plus any additional organizations granted by
// product features, and can be a member of others. Reads/writes go through the
// RLS-scoped server client; member email
// resolution uses the admin client (auth.users isn't readable via RLS). Role
// gating in app code uses src/lib/rbac; the DB enforces owner/admin at the
// policy layer as defense in depth.

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRole, type Role } from "@/lib/rbac";

export interface Organization {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  plan: "free" | "team" | "enterprise";
  createdAt: string;
  parentOrganizationId?: string | null;
  kind?: "organization" | "department" | "region" | null;
  isPersonal?: boolean;
}

export interface OrgMember {
  id: string;
  userId: string;
  email: string | null;
  role: Role;
  isOwner: boolean;
  createdAt: string;
}

interface OrgRow {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  plan: Organization["plan"];
  created_at: string;
  parent_organization_id?: string | null;
  kind?: "organization" | "department" | "region" | null;
  is_personal?: boolean;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export const ACTIVE_ORGANIZATION_COOKIE = "cq-active-organization";

function mapOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    createdAt: row.created_at,
    parentOrganizationId: row.parent_organization_id ?? null,
    kind: row.kind ?? null,
    isPersonal: row.is_personal ?? false,
  };
}

/** URL-safe, reasonably-unique slug seed from a free-form name. */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "org";
}

/**
 * The caller's organization, created on first access. The owner is also written
 * as an `owner` member row so membership checks are uniform. Wrapped in React
 * `cache` so the several per-request callers share one invocation.
 */
export const getOrCreateOrganization = cache(async (): Promise<Organization | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const existing = await supabase
    .from("organizations")
    .select("*")
    .eq("owner_id", user.id)
    .eq("is_personal", true)
    .maybeSingle();
  if (existing.data) return mapOrg(existing.data as OrgRow);

  const seed = slugify(user.email?.split("@")[0] ?? "org");
  const slug = `${seed}-${user.id.slice(0, 6)}`;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ owner_id: user.id, name: "My Organization", slug, is_personal: true })
    .select("*")
    .single();
  if (error || !data) return null;

  // Best-effort: the owner membership row keeps membership checks uniform, but
  // its failure is non-fatal — org_role() and is_org_member() both fall back to
  // organizations.owner_id, so the owner always resolves to 'owner' regardless.
  await supabase
    .from("organization_members")
    .insert({ organization_id: (data as OrgRow).id, user_id: user.id, role: "owner" });
  return mapOrg(data as OrgRow);
});

/** Lists organizations visible to the caller through organization membership. */
export async function listMyOrganizations(): Promise<Organization[]> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("organizations").select("*").order("created_at", { ascending: true });
    return ((data ?? []) as OrgRow[]).map(mapOrg);
  } catch {
    return [];
  }
}

export const listMyOrganizationsCached = cache(async (): Promise<Organization[]> => listMyOrganizations());

/**
 * Resolves the caller's selected organization from a validated cookie.
 * Invalid or missing selections fall back to the caller's personal organization.
 */
export const resolveActiveOrganizationId = cache(async (): Promise<string | null> => {
  try {
    const cookieStore = await cookies();
    const storedId = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
    const organizations = await listMyOrganizationsCached();
    if (storedId && organizations.some((organization) => organization.id === storedId)) return storedId;

    const personal = await getOrCreateOrganization();
    if (personal) return personal.id;
    return organizations[0]?.id ?? null;
  } catch {
    return null;
  }
});

/** Persists a selected organization after validating the caller's membership. */
export async function setActiveOrganizationId(orgId: string): Promise<boolean> {
  try {
    const organizations = await listMyOrganizations();
    if (!organizations.some((organization) => organization.id === orgId)) return false;

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, orgId, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return true;
  } catch {
    return false;
  }
}

/** Resolves the caller's active organization, falling back to the owned org. */
export async function getActiveOrganizationId(): Promise<string | null> {
  return resolveActiveOrganizationId();
}

/** Builds a PostgREST OR filter for active-organization rows plus own legacy rows. */
export function organizationReadFilter(userId: string, organizationId: string | null): string {
  return organizationId
    ? `organization_id.eq.${organizationId},and(user_id.eq.${userId},organization_id.is.null)`
    : `user_id.eq.${userId}`;
}

/** Cheap head-count of members for tab badges (no email resolution). */
export async function countOrgMembers(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
}

export async function updateOrganization(
  id: string,
  patch: { name?: string; plan?: Organization["plan"] }
): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, string> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim().slice(0, 120) || "My Organization";
  if (patch.plan !== undefined) update.plan = patch.plan;
  const { error } = await supabase.from("organizations").update(update).eq("id", id);
  return !error;
}

/** The caller's effective role in the org, or null when not a member. */
export async function getMyOrgRole(orgId: string): Promise<Role | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("org_role", { o_id: orgId });
  return typeof data === "string" && isRole(data) ? data : null;
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const supabase = await createClient();
  const { data: org } = await supabase.from("organizations").select("owner_id").eq("id", orgId).maybeSingle();
  const ownerId = (org as { owner_id: string } | null)?.owner_id ?? null;

  const { data, error } = await supabase
    .from("organization_members")
    .select("id, user_id, role, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const rows = data as MemberRow[];

  const admin = createAdminClient();
  const emailById = new Map<string, string | null>();
  const looked = await Promise.all(
    [...new Set(rows.map((r) => r.user_id))].map(async (id) => {
      const { data: u } = await admin.auth.admin.getUserById(id);
      return [id, u?.user?.email ?? null] as const;
    })
  );
  for (const [id, email] of looked) emailById.set(id, email);

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    email: emailById.get(r.user_id) ?? null,
    role: isRole(r.role) ? r.role : "member",
    isOwner: r.user_id === ownerId,
    createdAt: r.created_at,
  }));
}

export async function addOrgMemberByEmail(
  orgId: string,
  email: string,
  role: Role
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) return { ok: false, error: "Enter a valid email address." };
  if (role === "owner") return { ok: false, error: "Ownership can't be granted here — transfer it separately." };

  const admin = createAdminClient();
  // auth.users isn't queryable directly; page through admin listing to resolve.
  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page += 1) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const match = data?.users.find((u) => u.email?.toLowerCase() === trimmed);
    if (match) userId = match.id;
    if (!data || data.users.length < 200) break;
  }
  if (!userId) return { ok: false, error: "No Comply-Quick account uses that email yet." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "That user is already a member." : "Could not add member." };
  }
  return { ok: true };
}

export async function updateOrgMemberRole(memberId: string, role: Role): Promise<boolean> {
  if (role === "owner") return false;
  const supabase = await createClient();
  const { error } = await supabase.from("organization_members").update({ role }).eq("id", memberId);
  return !error;
}

export async function removeOrgMember(memberId: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("organization_members").delete().eq("id", memberId);
  return !error;
}
