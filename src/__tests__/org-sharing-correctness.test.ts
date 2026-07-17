import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getActiveOrganizationId = vi.fn();
const getMyOrgRole = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ insert }),
  }),
}));

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId,
  getMyOrgRole,
  organizationReadFilter: () => "organization_id.eq.org-1",
}));

describe("organization sharing correctness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getActiveOrganizationId.mockResolvedValue("org-1");
    getMyOrgRole.mockResolvedValue("member");
  });

  it("rejects integration creation for regular organization members", async () => {
    const { addIntegration } = await import("@/lib/integrations-db");

    await expect(
      addIntegration({ kind: "webhook", name: "Team hook", targetUrl: "https://hooks.example.test/team" })
    ).resolves.toEqual({ ok: false, error: "Only owners and admins can manage integrations." });
    expect(insert).not.toHaveBeenCalled();
  });

  it("allows integration creation for organization admins", async () => {
    getMyOrgRole.mockResolvedValue("admin");
    insert.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "integration-1",
            kind: "webhook",
            name: "Team hook",
            target_url: "https://hooks.example.test/team",
            active: true,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          error: null,
        }),
      }),
    });
    const { addIntegration } = await import("@/lib/integrations-db");

    await expect(
      addIntegration({ kind: "webhook", name: "Team hook", targetUrl: "https://hooks.example.test/team" })
    ).resolves.toMatchObject({ ok: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ organization_id: "org-1", user_id: "user-1" }));
  });

  it("defers the integration gate when no active organization is resolved", async () => {
    getActiveOrganizationId.mockResolvedValue(null);
    insert.mockReturnValue({
      select: () => ({
        single: async () => ({
          data: {
            id: "integration-personal",
            kind: "webhook",
            name: "Personal hook",
            target_url: "https://hooks.example.test/personal",
            active: true,
            created_at: "2026-01-01T00:00:00.000Z",
          },
          error: null,
        }),
      }),
    });
    const { addIntegration } = await import("@/lib/integrations-db");

    await expect(
      addIntegration({ kind: "webhook", name: "Personal hook", targetUrl: "https://hooks.example.test/personal" })
    ).resolves.toMatchObject({ ok: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ organization_id: null }));
  });

  it("tags alert impacts from the impacted project's organization", async () => {
    const projectMaybeSingle = vi.fn().mockResolvedValue({ data: { organization_id: "org-project" } });
    const projectQuery = {
      select: () => projectQuery,
      eq: () => projectQuery,
      maybeSingle: projectMaybeSingle,
    };
    const adminInsert = vi.fn().mockResolvedValue({ error: null });
    const admin = {
      from: (table: string) => (table === "projects" ? projectQuery : { insert: adminInsert }),
    };
    const { recordAlertImpact } = await import("@/lib/regulations/alert-impacts");

    await recordAlertImpact(admin as never, {
      userId: "owner-personal",
      projectId: "project-1",
      versionId: null,
      regulationId: "regulation-1",
      regulationName: "Test regulation",
      riskLevel: "high",
    });

    expect(adminInsert).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: "project-1", organization_id: "org-project" })
    );
  });
});
