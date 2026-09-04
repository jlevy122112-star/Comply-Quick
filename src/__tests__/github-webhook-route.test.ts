import { beforeEach, describe, expect, it, vi } from "vitest";

const maybeSingle = vi.fn();
const upsert = vi.fn();
const update = vi.fn();
const enqueueGitHubScan = vi.fn();
const getGitHubConnectionById = vi.fn();

vi.mock("@/lib/github/app-service", () => ({
  getGitHubWebhookSecret: () => "secret",
}));

vi.mock("@/lib/github/service", () => ({
  enqueueGitHubScan,
  getGitHubConnectionById,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    schema: () => ({
      from: (table: string) => {
        if (table === "connector_connections") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle,
                    }),
                  }),
                }),
              }),
            }),
            update: (payload: Record<string, unknown>) => {
              update(payload);
              return { eq: async () => ({ error: null }) };
            },
          };
        }
        if (table === "github_push_events") {
          return {
            upsert: (payload: Record<string, unknown>) => {
              upsert(payload);
              return { select: () => ({ maybeSingle: async () => ({ data: { id: "push-1" }, error: null }) }) };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    }),
  }),
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/webhooks/github/route");
}

describe("POST /api/webhooks/github", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: { id: "conn-1" }, error: null });
    enqueueGitHubScan.mockResolvedValue({ queued: true, duplicate: false, id: "scan-1" });
    getGitHubConnectionById.mockResolvedValue({ id: "conn-1" });
  });

  it("accepts signed push events and queues scans", async () => {
    const payload = JSON.stringify({
      installation: { id: 12 },
      repository: { id: 99, full_name: "acme/site" },
      ref: "refs/heads/main",
      after: "abc1234",
      before: "def5678",
      sender: { login: "octo" },
    });
    const crypto = await import("node:crypto");
    const signature = `sha256=${crypto.createHmac("sha256", "secret").update(payload).digest("hex")}`;
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://localhost/api/webhooks/github", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-github-event": "push",
          "x-github-delivery": "delivery-1",
          "x-hub-signature-256": signature,
        },
        body: payload,
      })
    );
    expect(response.status).toBe(202);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ repo_full_name: "acme/site", delivery_id: "delivery-1" })
    );
    expect(enqueueGitHubScan).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: "conn-1", repoFullName: "acme/site" })
    );
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ last_webhook_at: expect.any(String) }));
  });
});
