import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "owner-1",
  taskProjectId: "project-1",
  scopeByProject: new Map<
    string,
    { id: string; userId: string; organizationId: string | null; workspaceId: string | null }
  >([
    ["project-1", { id: "project-1", userId: "owner-1", organizationId: "org-1", workspaceId: "ws-1" }],
    ["project-2", { id: "project-2", userId: "owner-1", organizationId: "org-1", workspaceId: "ws-1" }],
  ]),
  filters: [] as Array<[string, string | null]>,
}));

vi.mock("@/lib/projects-db", () => ({
  getProjectTenantScope: async (projectId: string) => state.scopeByProject.get(projectId) ?? null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) },
    from: (table: string) => {
      if (table !== "compliance_tasks") throw new Error(`Unexpected table ${table}`);
      let mode: "update" | "delete" | null = null;
      const builder = {
        select: () => builder,
        update: () => {
          mode = "update";
          return builder;
        },
        delete: () => {
          mode = "delete";
          return builder;
        },
        eq: (column: string, value: string) => {
          state.filters.push([column, value]);
          return builder;
        },
        is: (column: string, value: null) => {
          state.filters.push([column, value]);
          return builder;
        },
        maybeSingle: async () => {
          const projectId = state.filters.find(([column]) => column === "project_id")?.[1];
          const organizationId = state.filters.find(([column]) => column === "organization_id")?.[1];
          const matchesProject = projectId === state.taskProjectId;
          const matchesOrg = organizationId === "org-1";
          if (mode && matchesProject && matchesOrg) {
            return {
              data: {
                id: "task-1",
                project_id: "project-1",
                title: "Review",
                description: "",
                category: "task",
                severity: "info",
                due_date: "2030-01-01",
                status: "done",
                source: "manual",
                created_at: "2026-01-01T00:00:00.000Z",
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  }),
}));

describe("project task boundary enforcement", () => {
  beforeEach(() => {
    state.userId = "owner-1";
    state.taskProjectId = "project-1";
    state.scopeByProject = new Map([
      ["project-1", { id: "project-1", userId: "owner-1", organizationId: "org-1", workspaceId: "ws-1" }],
      ["project-2", { id: "project-2", userId: "owner-1", organizationId: "org-1", workspaceId: "ws-1" }],
    ]);
    state.filters = [];
    vi.resetModules();
  });

  it("updates a task when the provided project matches the task tenant scope", async () => {
    const { setProjectTaskStatus } = await import("@/lib/workspace/tasks");

    await expect(setProjectTaskStatus("project-1", "task-1", "done")).resolves.toMatchObject({ id: "task-1" });
    expect(state.filters).toContainEqual(["project_id", "project-1"]);
    expect(state.filters).toContainEqual(["organization_id", "org-1"]);
  });

  it("rejects updating a task through another project id", async () => {
    const { setProjectTaskStatus } = await import("@/lib/workspace/tasks");

    await expect(setProjectTaskStatus("project-2", "task-1", "done")).rejects.toThrow("Task not found.");
  });

  it("throws not found when deleting a missing task", async () => {
    state.taskProjectId = "missing-project";
    const { deleteProjectTask } = await import("@/lib/workspace/tasks");

    await expect(deleteProjectTask("project-1", "task-404")).rejects.toThrow("Task not found.");
  });

  it("rejects deleting a task through another project id", async () => {
    const { deleteProjectTask } = await import("@/lib/workspace/tasks");

    await expect(deleteProjectTask("project-2", "task-1")).rejects.toThrow("Task not found.");
  });
});
