// Organizations — server data layer (enterprise multi-tenancy).
//
// The top of the tenant hierarchy: organization → workspace → project. A user
// owns at most one organization (created on first access) and can be a member of
// others. Reads/writes go through the RLS-scoped server client; member email
// resolution uses the admin client (auth.users isn't readable via RLS). Role
// gating in app code uses src/lib/rbac; the DB enforces owner/admin at the
// policy layer as defense in depth.

import { cache } from "react";
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
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
}

function mapOrg(row: OrgRow): Organization {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    createdAt: row.created_at,
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

  const existing = await supabase.from("organizations").select("*").eq("owner_id", user.id).maybeSingle();
  if (existing.data) return mapOrg(existing.data as OrgRow);

  const seed = slugify(user.email?.split("@")[0] ?? "org");
  const slug = `${seed}-${user.id.slice(0, 6)}`;
  const { data, error } = await supabase
    .from("organizations")
    .insert({ owner_id: user.id, name: "My Organization", slug })
    .select("*")
    .single();
  if (error || !data) return null;

  await supabase
    .from("organization_members")
    .insert({ organization_id: (data as OrgRow).id, user_id: user.id, role: "owner" });
  return mapOrg(data as OrgRow);
});

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
