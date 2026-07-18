import { createClient } from "@/lib/supabase/server";
import { type Organization } from "@/lib/organizations-db";
export type { Organization } from "@/lib/organizations-db";

export type OrganizationKind = "organization" | "department" | "region";

export interface OrganizationTreeNode extends Organization {
  children: OrganizationTreeNode[];
}

function asOrganization(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    name: row.name as string,
    slug: row.slug as string,
    plan: row.plan as Organization["plan"],
    createdAt: row.created_at as string,
    parentOrganizationId: (row.parent_organization_id as string | null | undefined) ?? null,
    kind: (row.kind as OrganizationKind | null | undefined) ?? null,
    isPersonal: Boolean(row.is_personal),
  };
}

async function isHierarchyAdmin(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data, error } = await supabase.rpc("is_org_hierarchy_admin", { o_id: organizationId });
  return !error && data === true;
}

export async function isOrganizationHierarchyAdmin(organizationId: string): Promise<boolean> {
  return isHierarchyAdmin(await createClient(), organizationId);
}

async function getOrganization(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data, error } = await supabase.from("organizations").select("*").eq("id", organizationId).maybeSingle();
  if (error || !data) return null;
  return asOrganization(data as Record<string, unknown>);
}

export async function listOrganizationAncestors(organizationId: string): Promise<Organization[]> {
  const supabase = await createClient();
  const organizations: Organization[] = [];
  let current = await getOrganization(supabase, organizationId);
  while (current) {
    organizations.push(current);
    if (!current.parentOrganizationId) break;
    current = await getOrganization(supabase, current.parentOrganizationId);
  }
  return collectOrganizationAncestors(organizations, organizationId);
}

export async function listOrganizationDescendants(organizationId: string): Promise<Organization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations").select("*");
  if (error || !data) return [];
  const all = (data as Record<string, unknown>[]).map(asOrganization);
  return collectOrganizationDescendants(all, organizationId);
}

export async function listOrganizationSubtree(organizationId: string): Promise<OrganizationTreeNode | null> {
  const root = await getOrganization(await createClient(), organizationId);
  if (!root) return null;
  const descendants = await listOrganizationDescendants(organizationId);
  return buildOrganizationTree([root, ...descendants], root.id);
}

export function buildOrganizationTree(organizations: Organization[], rootId: string): OrganizationTreeNode | null {
  const nodes = new Map<string, OrganizationTreeNode>();
  for (const organization of organizations) nodes.set(organization.id, { ...organization, children: [] });
  for (const node of nodes.values()) {
    if (node.parentOrganizationId) nodes.get(node.parentOrganizationId)?.children.push(node);
  }
  return nodes.get(rootId) ?? null;
}

export function collectOrganizationAncestors(organizations: Organization[], organizationId: string): Organization[] {
  const byId = new Map(organizations.map((organization) => [organization.id, organization]));
  const ancestors: Organization[] = [];
  const seen = new Set<string>();
  let current = byId.get(organizationId);
  while (current?.parentOrganizationId && !seen.has(current.id)) {
    seen.add(current.id);
    current = byId.get(current.parentOrganizationId);
    if (current) ancestors.push(current);
  }
  return ancestors;
}

export function collectOrganizationDescendants(organizations: Organization[], organizationId: string): Organization[] {
  const descendants: Organization[] = [];
  const queue = [organizationId];
  while (queue.length) {
    const parentId = queue.shift() as string;
    for (const organization of organizations) {
      if (organization.parentOrganizationId === parentId && organization.id !== organizationId) {
        descendants.push(organization);
        queue.push(organization.id);
      }
    }
  }
  return descendants;
}

export async function createChildOrganization(input: {
  parentOrganizationId: string;
  name: string;
  kind?: OrganizationKind;
}): Promise<Organization> {
  const supabase = await createClient();
  const parent = await getOrganization(supabase, input.parentOrganizationId);
  if (!parent || parent.isPersonal) throw new Error("Personal organizations cannot be parents.");
  if (!(await isHierarchyAdmin(supabase, parent.id))) throw new Error("You cannot manage this organization hierarchy.");
  const name = input.name.trim();
  if (!name) throw new Error("An organization name is required.");
  const slug = `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  }-${crypto.randomUUID().slice(0, 8)}`;
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("You must be signed in.");
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      owner_id: userData.user.id,
      name,
      slug,
      plan: parent.plan,
      parent_organization_id: parent.id,
      kind: input.kind ?? "organization",
      is_personal: false,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("Could not create the child organization.");
  return asOrganization(data as Record<string, unknown>);
}

export async function reparentOrganization(
  organizationId: string,
  parentOrganizationId: string | null
): Promise<boolean> {
  const supabase = await createClient();
  const organization = await getOrganization(supabase, organizationId);
  if (!organization || organization.isPersonal) throw new Error("Personal organizations cannot be moved.");
  if (!(await isHierarchyAdmin(supabase, organization.id)))
    throw new Error("You cannot manage this organization hierarchy.");
  if (parentOrganizationId) {
    const parent = await getOrganization(supabase, parentOrganizationId);
    if (!parent || parent.isPersonal) throw new Error("Personal organizations cannot be hierarchy nodes.");
    if (!(await isHierarchyAdmin(supabase, parent.id))) throw new Error("You cannot manage the destination hierarchy.");
  }
  const { error } = await supabase
    .from("organizations")
    .update({ parent_organization_id: parentOrganizationId })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);
  return true;
}
