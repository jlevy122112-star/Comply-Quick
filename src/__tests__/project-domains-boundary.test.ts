import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "owner-1",
  scope: { id: "project-1", userId: "owner-1", organizationId: "org-1", workspaceId: "ws-1" },
  deleteProjectId: "project-1",
  filters: [] as Array<[string, string]>,
}));

vi.mock("@/lib/projects-db", () => ({
  getProjectTenantScope: async () => state.scope,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) },
    from: (table: string) => {
      if (table !== "project_domains") throw new Error(`Unexpected table ${table}`);
      const builder = {
        delete: () => builder,
        eq: (column: string, value: string) => {
          state.filters.push([column, value]);
          return builder;
        },
        select: () => builder,
        maybeSingle: async () => ({
          data:
            state.filters.find(([column]) => column === "project_id")?.[1] === state.deleteProjectId
              ? { id: "domain-1" }
              : null,
          error: null,
        }),
      };
      return builder;
    },
  }),
}));

describe("project domain boundary enforcement", () => {
  beforeEach(() => {
    state.userId = "owner-1";
    state.scope = { id: "project-1", userId: "owner-1", organizationId: "org-1", workspaceId: "ws-1" };
    state.deleteProjectId = "project-1";
    state.filters = [];
    vi.resetModules();
  });

  it("removes a domain when the owner provides the correct project context", async () => {
    const { removeProjectDomain } = await import("@/lib/project-domains-db");

    await expect(removeProjectDomain("project-1", "domain-1")).resolves.toBe(true);
    expect(state.filters).toContainEqual(["project_id", "project-1"]);
  });

  it("rejects removal when the caller is not the project owner", async () => {
    state.userId = "member-1";
    const { removeProjectDomain } = await import("@/lib/project-domains-db");

    await expect(removeProjectDomain("project-1", "domain-1")).resolves.toBe(false);
  });

  it("rejects removal through another project id", async () => {
    const { removeProjectDomain } = await import("@/lib/project-domains-db");

    await expect(removeProjectDomain("project-2", "domain-1")).resolves.toBe(false);
  });
});
