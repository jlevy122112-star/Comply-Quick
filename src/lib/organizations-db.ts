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
import { THEME_PALETTES, type ThemePalette, type Organization } from "@/lib/organizations";

export { THEME_PALETTES, type ThemePalette, type Organization };

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
  parent_organization_id: string | null;
  is_personal: boolean;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  theme_palette: string;
  support_email: string | null;
  smtp_from_email: string | null;
  smtp_reply_to_email: string | null;
  created_at: string;
  updated_at: string;
  kind: Organization["kind"] | null;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

export const ACTIVE_ORGANIZATION_COOKIE = "cq-active-organization";

function isThemePalette(value: string): value is ThemePalette {
  return (THEME_PALETTES as readonly string[]).includes(value);
}

function mapOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    parentOrganizationId: row.parent_organization_id ?? null,
    isPersonal: row.is_personal ?? false,
    logoUrl: row.logo_url ?? null,
    faviconUrl: row.favicon_url ?? null,
    primaryColor: row.primary_color ?? "#4f46e5",
    themePalette: isThemePalette(row.theme_palette) ? row.theme_palette : "indigo",
    supportEmail: row.support_email ?? null,
    smtpFromEmail: row.smtp_from_email ?? null,
    smtpReplyToEmail: row.smtp_reply_to_email ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    kind: row.kind ?? null,
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    const [{ data: owned }, { data: memberships }] = await Promise.all([
      supabase.from("organizations").select("*").eq("owner_id", user.id),
      supabase.from("organization_members").select("organization_id").eq("user_id", user.id),
    ]);
    const ids = [...new Set((memberships ?? []).map((row) => row.organization_id as string))];
    const { data: memberOrganizations } = ids.length
      ? await supabase.from("organizations").select("*").in("id", ids)
      : { data: [] };
    const byId = new Map<string, OrgRow>();
    for (const row of [...(owned ?? []), ...(memberOrganizations ?? [])] as OrgRow[]) byId.set(row.id, row);
    return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).map(mapOrg);
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

export interface OrganizationBrandingPatch {
  name?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  themePalette?: ThemePalette;
  supportEmail?: string | null;
}

export interface OrganizationSmtpPatch {
  smtpFromEmail?: string | null;
  smtpReplyToEmail?: string | null;
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

export async function updateOrganizationBranding(id: string, patch: OrganizationBrandingPatch): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) update.name = patch.name.trim().slice(0, 120) || "My Organization";
  if (patch.logoUrl !== undefined) update.logo_url = patch.logoUrl;
  if (patch.faviconUrl !== undefined) update.favicon_url = patch.faviconUrl;
  if (patch.primaryColor !== undefined) update.primary_color = patch.primaryColor;
  if (patch.themePalette !== undefined) update.theme_palette = patch.themePalette;
  if (patch.supportEmail !== undefined) update.support_email = patch.supportEmail;
  const { error } = await supabase.from("organizations").update(update).eq("id", id);
  return !error;
}

export async function updateOrganizationSmtp(id: string, patch: OrganizationSmtpPatch): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.smtpFromEmail !== undefined) update.smtp_from_email = patch.smtpFromEmail;
  if (patch.smtpReplyToEmail !== undefined) update.smtp_reply_to_email = patch.smtpReplyToEmail;
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

/** Fetch a single organization the caller can see (owner or member of this org or an ancestor). */
export async function getOrganization(orgId: string): Promise<Organization | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("*").eq("id", orgId).maybeSingle();
  if (error || !data) return null;
  return mapOrg(data as OrgRow);
}

/** Direct children of an organization. */
export async function listOrganizationChildren(orgId: string): Promise<Organization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("*")
    .eq("parent_organization_id", orgId)
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as OrgRow[]).map(mapOrg);
}

/** Creates a child organization under `parentId`. The caller must be an admin of the parent. */
export async function createChildOrganization(
  parentId: string,
  name: string,
  plan: Organization["plan"] = "team"
): Promise<{ ok: true; organization: Organization } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized." };

  const parent = await getOrganization(parentId);
  if (!parent) return { ok: false, error: "Parent organization not found." };

  const base = slugify(name);
  const slug = `${base}-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      owner_id: user.id,
      name: name.trim().slice(0, 120) || "Child Organization",
      slug,
      plan,
      parent_organization_id: parentId,
      is_personal: false,
    })
    .select("*")
    .single();

  if (error || !data) {
    return { ok: false, error: "Could not create child organization." };
  }

  // Best-effort owner membership row for uniform role resolution.
  await supabase
    .from("organization_members")
    .insert({ organization_id: (data as OrgRow).id, user_id: user.id, role: "owner" })
    .maybeSingle();

  return { ok: true, organization: mapOrg(data as OrgRow) };
}

/** Moves an organization under a new parent, preventing cycles. */
export async function moveOrganization(
  orgId: string,
  newParentId: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();

  const org = await getOrganization(orgId);
  if (!org) return { ok: false, error: "Organization not found." };

  if (newParentId !== null) {
    const parent = await getOrganization(newParentId);
    if (!parent) return { ok: false, error: "Parent organization not found." };

    const { data } = await supabase.rpc("is_org_descendant", { ancestor: orgId, candidate: newParentId });
    if (data === true) {
      return { ok: false, error: "Cannot move an organization under one of its own descendants." };
    }
  }

  const { error } = await supabase
    .from("organizations")
    .update({ parent_organization_id: newParentId, updated_at: new Date().toISOString() })
    .eq("id", orgId);

  if (error) return { ok: false, error: "Could not move organization." };
  return { ok: true };
}

/** Full path from root to the given org, ordered root-first. */
export async function getOrganizationPath(orgId: string): Promise<Organization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_org_ancestors", { o_id: orgId });
  if (error || !data) return [];
  const ids = data as { id: string }[];
  const { data: rows } = await supabase
    .from("organizations")
    .select("*")
    .in(
      "id",
      ids.map((r) => r.id)
    );
  if (!rows) return [];
  const byId = new Map((rows as OrgRow[]).map((r) => [r.id, mapOrg(r)]));
  return ids.map((r) => byId.get(r.id)).filter((o): o is Organization => o !== undefined);
}
