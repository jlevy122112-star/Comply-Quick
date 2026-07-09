// Project memberships — server data layer (framework §3.1 / A5).
//
// Per-project collaboration on top of the agency org layer: the owner shares a
// project with named collaborators (by email) who then get read access via the
// additive RLS policies in migration 0024. All writes are gated to the project
// owner by RLS; this module resolves the invited email to a user id first.

import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProjectMemberRole = "owner" | "editor" | "viewer";

const LOOKUP_PAGE_SIZE = 200;
// Bound the search so a pathological account count can't turn one invite into an
// unbounded scan; 20 pages × 200 = 40k accounts covers realistic usage.
const LOOKUP_MAX_PAGES = 20;

/** Finds an account by email, paging through the admin user list until found. */
async function findUserByEmail(admin: SupabaseClient, normalizedEmail: string): Promise<User | null> {
  for (let page = 1; page <= LOOKUP_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: LOOKUP_PAGE_SIZE });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (match) return match;
    if (data.users.length < LOOKUP_PAGE_SIZE) break; // last page reached
  }
  return null;
}

export interface ProjectMember {
  id: string;
  userId: string;
  email: string;
  role: ProjectMemberRole;
  createdAt: string;
}

/** Lists the collaborators on a project the caller can see (RLS-scoped). */
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("project_members")
    .select("id, user_id, role, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (!data || data.length === 0) return [];

  // Resolve emails via the admin client (auth.users isn't readable through RLS).
  // Batched concurrently so N collaborators cost one round-trip, not N serial ones.
  const admin = createAdminClient();
  const emails = await Promise.all(
    data.map(async (row) => {
      const { data: authUser } = await admin.auth.admin.getUserById(row.user_id as string);
      return authUser.user?.email ?? "";
    })
  );
  return data.map((row, i) => ({
    id: row.id as string,
    userId: row.user_id as string,
    email: emails[i],
    role: row.role as ProjectMemberRole,
    createdAt: row.created_at as string,
  }));
}

export type AddMemberResult = { ok: true } | { ok: false; error: string };

/** Shares a project with a collaborator by email (owner-only, enforced by RLS). */
export async function addProjectMember(
  projectId: string,
  email: string,
  role: ProjectMemberRole = "viewer"
): Promise<AddMemberResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Ownership is conferred by creating the project, never by invitation — a
  // collaborator can only be added as an editor or viewer.
  if (role === "owner") return { ok: false, error: "Collaborators can only be editors or viewers." };

  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) return { ok: false, error: "Enter a valid email." };

  // Resolve the invitee to an existing account (invite-to-signup is out of scope).
  // The admin API has no lookup-by-email, so page through until found or
  // exhausted rather than only searching the first page.
  const admin = createAdminClient();
  const invitee = await findUserByEmail(admin, normalized);
  if (!invitee) return { ok: false, error: "No Comply-Quick account exists for that email yet." };
  if (invitee.id === user.id) return { ok: false, error: "You already own this project." };

  const { error } = await supabase.from("project_members").insert({ project_id: projectId, user_id: invitee.id, role });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That person is already a collaborator." };
    return { ok: false, error: "Could not add collaborator." };
  }
  return { ok: true };
}

/** Removes a collaborator from a project (owner-only, enforced by RLS). */
export async function removeProjectMember(memberId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);
  return !error;
}
