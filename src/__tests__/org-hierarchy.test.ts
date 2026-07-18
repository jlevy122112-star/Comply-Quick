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
});

describe("organization hierarchy", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/0051_organization_hierarchy.sql"), "utf8");

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
    expect(migration).toMatch(
      /with check \([\s\S]*parent_organization_id is null\s*or\s*\([\s\S]*not coalesce\(is_personal, false\)/
    );
  });

  it("rejects attaching a personal organization and permits a non-personal child under an administered parent", () => {
    expect(migration).toContain("and parent.is_personal");
    expect(migration).toContain("public.is_org_hierarchy_admin(parent_organization_id)");
    expect(migration).toContain("not coalesce(is_personal, false)");
  });
});
