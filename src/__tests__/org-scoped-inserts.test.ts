import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { recordAlertImpact } from "@/lib/regulations/alert-impacts";
import { addIntegration } from "@/lib/integrations-db";
import { createProjectTask } from "@/lib/workspace/tasks";

const { serverRows, mockServerClient } = vi.hoisted(() => ({
  serverRows: [] as Record<string, unknown>[],
  mockServerClient: {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-a" } } }),
    },
    from: (table: string) => {
      if (table === "projects") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "project-a" }, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        insert: (row: Record<string, unknown>) => {
          serverRows.push(row);
          return {
            select: () => ({
              single: async () => ({
                data: { ...row, id: "integration-a", created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          };
        },
      };
    },
  },
}));

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId: async () => "org-a",
  getMyOrgRole: async () => "owner",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mockServerClient,
}));

describe("organization-scoped insert paths", () => {
  it("tags authenticated server inserts with the active organization", async () => {
    serverRows.length = 0;
    const result = await addIntegration({
      kind: "webhook",
      name: "Audit webhook",
      targetUrl: "https://example.com/hook",
    });

    expect(result.ok).toBe(true);
    expect(serverRows[0]).toMatchObject({
      user_id: "user-a",
      organization_id: "org-a",
    });
  });

  it("tags project-task inserts with the active organization", async () => {
    serverRows.length = 0;
    const result = await createProjectTask({
      projectId: "project-a",
      title: "Review policy",
      dueDate: "2030-01-15",
    });

    expect(result.projectId).toBe("project-a");
    expect(serverRows[0]).toMatchObject({
      user_id: "user-a",
      organization_id: "org-a",
      project_id: "project-a",
    });
  });

  it("includes organization_id in every requested insert path", () => {
    const paths = [
      "src/lib/projects-db.ts",
      "src/lib/scanner/service.ts",
      "src/lib/findings-db.ts",
      "src/lib/evidence-db.ts",
      "src/lib/calendar/service.ts",
      "src/lib/workspace/tasks.ts",
      "src/lib/integrations-db.ts",
      "src/lib/audit-log.ts",
      "src/lib/regulations/alert-impacts.ts",
      "src/lib/intelligence/service.ts",
    ];

    for (const path of paths) {
      const source = readFileSync(path, "utf8");
      expect(source, path).toContain("organization_id");
    }
  });

  it("tags service-role alert-impact inserts from the user's organization", async () => {
    const rows: Record<string, unknown>[] = [];
    const admin = {
      from(table: string) {
        if (table === "organizations") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { id: "org-a" }, error: null }),
              }),
            }),
          };
        }
        return {
          insert: (row: Record<string, unknown>) => {
            rows.push(row);
            return Promise.resolve({ data: row, error: null });
          },
        };
      },
    } as never;

    await recordAlertImpact(admin, {
      userId: "user-a",
      projectId: "project-a",
      versionId: null,
      regulationId: "reg-a",
      regulationName: "Regulation A",
      riskLevel: "low",
    });

    expect(rows[0]).toMatchObject({
      user_id: "user-a",
      organization_id: "org-a",
      project_id: "project-a",
    });
  });
});
