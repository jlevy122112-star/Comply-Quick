import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "user-1",
  activeOrganizationId: "org-a" as string | null,
  project: {
    id: "project-1",
    user_id: "user-1",
    organization_id: "org-a" as string | null,
    workspace_id: "ws-1" as string | null,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: state.userId } } }),
    },
    from: (table: string) => {
      if (table !== "projects") throw new Error(`Unexpected table ${table}`);
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: state.project, error: null }),
      };
      return builder;
    },
  }),
}));

vi.mock("@/lib/organizations-db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/organizations-db")>("@/lib/organizations-db");
  return {
    ...actual,
    getActiveOrganizationId: async () => state.activeOrganizationId,
  };
});

describe("getProjectTenantScope", () => {
  beforeEach(() => {
    state.userId = "user-1";
    state.activeOrganizationId = "org-a";
    state.project = {
      id: "project-1",
      user_id: "user-1",
      organization_id: "org-a",
      workspace_id: "ws-1",
    };
    vi.resetModules();
  });

  it("returns scope for a project inside the active organization", async () => {
    const { getProjectTenantScope } = await import("@/lib/projects-db");

    await expect(getProjectTenantScope("project-1")).resolves.toMatchObject({
      id: "project-1",
      organizationId: "org-a",
      workspaceId: "ws-1",
    });
  });

  it("blocks a project from another organization even when the row is readable", async () => {
    state.project.organization_id = "org-b";
    const { getProjectTenantScope } = await import("@/lib/projects-db");

    await expect(getProjectTenantScope("project-1")).resolves.toBeNull();
  });

  it("keeps legacy personal rows user-scoped", async () => {
    state.project.organization_id = null;
    state.project.workspace_id = null;
    const { getProjectTenantScope } = await import("@/lib/projects-db");

    await expect(getProjectTenantScope("project-1")).resolves.toMatchObject({
      id: "project-1",
      organizationId: null,
      workspaceId: null,
      userId: "user-1",
    });
  });
});
