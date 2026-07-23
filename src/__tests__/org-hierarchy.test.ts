import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildOrganizationTree,
  collectOrganizationAncestors,
  collectOrganizationDescendants,
  type Organization,
} from "@/lib/org-hierarchy";

const organization = (id: string, parentOrganizationId: string | null): Organization => ({
  id,
  ownerId: "owner",
  name: id,
  slug: id,
  plan: "enterprise",
  createdAt: "2025-01-01T00:00:00.000Z",
  parentOrganizationId,
  kind: "organization",
  isPersonal: false,
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#4f46e5",
  themePalette: "indigo",
  supportEmail: null,
  smtpFromEmail: null,
  smtpReplyToEmail: null,
  updatedAt: "2025-01-01T00:00:00.000Z",
});

describe("organization hierarchy", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/20260714000009_organization_hierarchy.sql"),
    "utf8"
  );
  const hierarchySource = readFileSync(join(process.cwd(), "src/lib/org-hierarchy.ts"), "utf8");
  const organizationsSource = readFileSync(join(process.cwd(), "src/lib/organizations-db.ts"), "utf8");

  it("builds a nested subtree from parent links", () => {
    const tree = buildOrganizationTree(
      [organization("root", null), organization("department", "root"), organization("region", "department")],
      "root"
    );
    expect(tree?.children[0].id).toBe("department");
    expect(tree?.children[0].children[0].id).toBe("region");
  });

  it("does not invent a root when the requested organization is absent", () => {
    expect(buildOrganizationTree([organization("root", null)], "missing")).toBeNull();
  });

  it("resolves ancestors and descendants without granting cross-tree access", () => {
    const organizations = [
      organization("root", null),
      organization("department", "root"),
      organization("region", "department"),
      organization("other", null),
    ];
    expect(collectOrganizationAncestors(organizations, "region").map((item) => item.id)).toEqual([
      "department",
      "root",
    ]);
    expect(collectOrganizationDescendants(organizations, "root").map((item) => item.id)).toEqual([
      "department",
      "region",
    ]);
  });

  it("allows personal organization updates when they remain roots", () => {
    expect(migration).toContain("parent_organization_id is distinct from old.parent_organization_id");
    expect(migration).toContain("tg_op = 'UPDATE'");
    expect(migration).toContain("drop policy if exists organizations_hierarchy_update_guard");
    expect(migration).not.toContain("create policy organizations_hierarchy_update_guard");
  });

  it("rejects personal hierarchy attachments and permits delegated reparenting", () => {
    expect(migration).toContain("and parent.is_personal");
    expect(migration).toContain("public.is_org_hierarchy_admin(parent_organization_id)");
    expect(migration).toContain("not coalesce(is_personal, false)");
    expect(migration).toContain("create policy organizations_update_hierarchy");
    expect(migration).toContain("with check (public.is_org_hierarchy_admin(id))");
  });

  it("adds child owners to the organization roster and keeps the switcher membership-scoped", () => {
    expect(hierarchySource).toContain('.from("organization_members").insert');
    expect(hierarchySource).toContain('role: "owner"');
    expect(organizationsSource).toContain('.from("organization_members").select("organization_id")');
    expect(organizationsSource).toContain('.in("id", ids)');
  });
});
