import { describe, expect, it } from "vitest";
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
});
