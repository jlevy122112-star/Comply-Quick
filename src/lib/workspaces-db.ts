// Workspaces — server data layer (enterprise multi-tenancy).
//
// The middle tier of the hierarchy: organization → workspace → project. A
// workspace groups projects for a team or client engagement. Reads are visible
// to any org member (RLS is_workspace_member); create/update require manager+ and
// deletion requires admin+, enforced both in app code (rbac) and at the policy
// layer. Project counts are resolved in one batched pass for the list view.

import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId, slugify } from "@/lib/organizations-db";
import { THEME_PALETTES, type ThemePalette } from "@/lib/organizations";

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  themePalette: ThemePalette;
  footerText: string | null;
  projectCount: number;
  createdAt: string;
}

interface WorkspaceRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  theme_palette: string | null;
  footer_text: string | null;
  created_at: string;
}

export interface WorkspaceBrandingPatch {
  logoUrl?: string | null;
  primaryColor?: string;
  themePalette?: ThemePalette;
  footerText?: string | null;
}

function isThemePalette(value: string | null | undefined): value is ThemePalette {
  return typeof value === "string" && (THEME_PALETTES as readonly string[]).includes(value);
}

function rowToWorkspace(row: WorkspaceRow, projectCount = 0): Workspace {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url ?? null,
    primaryColor: row.primary_color ?? "#4f46e5",
    themePalette: isThemePalette(row.theme_palette) ? row.theme_palette : "indigo",
    footerText: row.footer_text ?? null,
    projectCount,
    createdAt: row.created_at,
  };
}

export async function listWorkspaces(orgId: string): Promise<Workspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, organization_id, name, slug, logo_url, primary_color, theme_palette, footer_text, created_at")
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

  return rows.map((r) => rowToWorkspace(r, counts.get(r.id) ?? 0));
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

export async function getWorkspaceById(id: string, organizationId?: string | null): Promise<Workspace | null> {
  const supabase = await createClient();
  const activeOrganizationId = organizationId === undefined ? await getActiveOrganizationId() : organizationId;
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, organization_id, name, slug, logo_url, primary_color, theme_palette, footer_text, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as WorkspaceRow;
  if (activeOrganizationId && row.organization_id !== activeOrganizationId) return null;
  return rowToWorkspace(row);
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

export async function renameWorkspace(id: string, name: string, organizationId?: string): Promise<boolean> {
  const clean = name.trim();
  if (clean.length < 2) return false;
  const supabase = await createClient();
  let query = supabase
    .from("workspaces")
    .update({ name: clean.slice(0, 120), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.select("id").maybeSingle();
  return !error && !!data;
}

export async function deleteWorkspace(id: string, organizationId?: string): Promise<boolean> {
  const supabase = await createClient();
  let query = supabase.from("workspaces").delete().eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.select("id").maybeSingle();
  return !error && !!data;
}

export async function updateWorkspaceBranding(
  id: string,
  patch: WorkspaceBrandingPatch,
  organizationId?: string
): Promise<boolean> {
  const supabase = await createClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.logoUrl !== undefined) update.logo_url = patch.logoUrl;
  if (patch.primaryColor !== undefined) update.primary_color = patch.primaryColor;
  if (patch.themePalette !== undefined) update.theme_palette = patch.themePalette;
  if (patch.footerText !== undefined) update.footer_text = patch.footerText;
  let query = supabase.from("workspaces").update(update).eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.select("id").maybeSingle();
  return !error && !!data;
}
