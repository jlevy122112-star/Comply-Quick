// Workspaces — server data layer (enterprise multi-tenancy).
//
// The middle tier of the hierarchy: organization → workspace → project. A
// workspace groups projects for a team or client engagement. Reads are visible
// to any org member (RLS is_workspace_member); create/update require manager+ and
// deletion requires admin+, enforced both in app code (rbac) and at the policy
// layer. Project counts are resolved in one batched pass for the list view.

import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/organizations-db";

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  projectCount: number;
  createdAt: string;
}

interface WorkspaceRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  created_at: string;
}

export async function listWorkspaces(orgId: string): Promise<Workspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, organization_id, name, slug, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  const rows = data as WorkspaceRow[];

  // Batch the per-workspace project counts into one query, then tally in memory.
  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const { data: projRows } = await supabase.from("projects").select("workspace_id").in("workspace_id", ids);
    for (const p of (projRows as { workspace_id: string | null }[] | null) ?? []) {
      if (p.workspace_id) counts.set(p.workspace_id, (counts.get(p.workspace_id) ?? 0) + 1);
    }
  }

  return rows.map((r) => ({
    id: r.id,
    organizationId: r.organization_id,
    name: r.name,
    slug: r.slug,
    projectCount: counts.get(r.id) ?? 0,
    createdAt: r.created_at,
  }));
}

/** Cheap head-count of workspaces for tab badges (no project tallying). */
export async function countWorkspaces(orgId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("workspaces")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId);
  return count ?? 0;
}

export async function createWorkspace(
  orgId: string,
  name: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Workspace name must be at least 2 characters." };

  const supabase = await createClient();
  const slug = slugify(clean);
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ organization_id: orgId, name: clean.slice(0, 120), slug })
    .select("id")
    .single();
  if (error || !data) {
    return {
      ok: false,
      error:
        error?.code === "23505" ? "A workspace with a similar name already exists." : "Could not create workspace.",
    };
  }
  return { ok: true, id: (data as { id: string }).id };
}

export async function renameWorkspace(id: string, name: string): Promise<boolean> {
  const clean = name.trim();
  if (clean.length < 2) return false;
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspaces")
    .update({ name: clean.slice(0, 120), updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

export async function deleteWorkspace(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("workspaces").delete().eq("id", id);
  return !error;
}
