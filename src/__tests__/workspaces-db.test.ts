import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  matchedRow: { id: "ws-1" } as Record<string, unknown> | null,
  filters: [] as Array<[string, string]>,
  activeOrganizationId: "org-1" as string | null,
  workspaceRow: {
    id: "ws-1",
    organization_id: "org-1",
    name: "Workspace One",
    slug: "workspace-one",
    created_at: "2026-09-01T00:00:00.000Z",
  } as Record<string, unknown> | null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (table: string) => {
      if (table !== "workspaces") throw new Error(`Unexpected table ${table}`);
      let operation: "read" | "update" | "delete" = "read";
      const builder = {
        select: () => builder,
        update: () => {
          operation = "update";
          return builder;
        },
        delete: () => {
          operation = "delete";
          return builder;
        },
        eq: (column: string, value: string) => {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => ({
          data: operation === "read" ? state.workspaceRow : state.matchedRow,
          error: null,
        }),
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

describe("workspace write guards", () => {
  beforeEach(() => {
    state.matchedRow = { id: "ws-1" };
    state.filters = [];
    state.activeOrganizationId = "org-1";
    state.workspaceRow = {
      id: "ws-1",
      organization_id: "org-1",
      name: "Workspace One",
      slug: "workspace-one",
      created_at: "2026-09-01T00:00:00.000Z",
    };
    vi.resetModules();
  });

  it("returns a workspace when the active organization matches", async () => {
    const { getWorkspaceById } = await import("@/lib/workspaces-db");

    await expect(getWorkspaceById("ws-1")).resolves.toMatchObject({
      id: "ws-1",
      organizationId: "org-1",
      name: "Workspace One",
    });
  });

  it("returns null when the workspace belongs to another organization", async () => {
    state.activeOrganizationId = "org-2";
    const { getWorkspaceById } = await import("@/lib/workspaces-db");

    await expect(getWorkspaceById("ws-1")).resolves.toBeNull();
  });

  it("returns true when a workspace rename matches the expected organization", async () => {
    const { renameWorkspace } = await import("@/lib/workspaces-db");

    await expect(renameWorkspace("ws-1", "Renamed", "org-1")).resolves.toBe(true);
    expect(state.filters).toContainEqual(["organization_id", "org-1"]);
  });

  it("returns false when a workspace rename matches no row", async () => {
    state.matchedRow = null;
    const { renameWorkspace } = await import("@/lib/workspaces-db");

    await expect(renameWorkspace("ws-1", "Renamed", "org-1")).resolves.toBe(false);
  });

  it("returns false when a workspace delete matches no row", async () => {
    state.matchedRow = null;
    const { deleteWorkspace } = await import("@/lib/workspaces-db");

    await expect(deleteWorkspace("ws-1", "org-1")).resolves.toBe(false);
  });
});
