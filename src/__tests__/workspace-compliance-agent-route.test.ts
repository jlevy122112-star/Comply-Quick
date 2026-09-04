import { beforeEach, describe, expect, it, vi } from "vitest";

const insertSpy = vi.fn();
const resolveWorkspaceApiKey = vi.fn();

vi.mock("@/lib/workspace-api-keys", () => ({
  resolveWorkspaceApiKey: (...args: unknown[]) => resolveWorkspaceApiKey(...args),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table !== "compliance_agent_events") throw new Error(`Unexpected table ${table}`);
      return {
        insert: async (payload: Record<string, unknown>) => {
          insertSpy(payload);
          return { error: null };
        },
      };
    },
  }),
}));

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/compliance-agent/route");
}

function post(body: unknown) {
  return new Request("http://localhost/api/compliance-agent", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/compliance-agent", () => {
  beforeEach(() => {
    insertSpy.mockReset();
    resolveWorkspaceApiKey.mockReset();
  });

  it("records tenant-safe telemetry for a resolved workspace key", async () => {
    resolveWorkspaceApiKey.mockResolvedValue({
      keyId: "key_1",
      organizationId: "org_1",
      workspaceId: "ws_1",
    });

    const { POST } = await loadRoute();
    const res = await POST(
      post({
        key: "cq_live_secret",
        url: "https://client.example.com/pricing",
        title: "Pricing",
        referrer: "https://google.com",
        workspaceId: "forged_ws",
        origin: "https://client.example.com",
        host: "client.example.com",
        path: "/pricing",
      })
    );

    expect(res.status).toBe(200);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org_1",
        workspace_id: "ws_1",
        client_api_key_id: "key_1",
        url: "https://client.example.com/pricing",
      })
    );
    expect(insertSpy.mock.calls[0]?.[0]).not.toHaveProperty("workspaceId", "forged_ws");
  });

  it("rejects invalid keys", async () => {
    resolveWorkspaceApiKey.mockResolvedValue(null);

    const { POST } = await loadRoute();
    const res = await POST(post({ key: "cq_live_bad", url: "https://client.example.com" }));

    expect(res.status).toBe(401);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
