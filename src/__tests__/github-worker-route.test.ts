import { describe, expect, it, vi } from "vitest";

const processGitHubScanQueue = vi.fn();

vi.mock("@/lib/github/service", () => ({
  processGitHubScanQueue,
}));

async function loadRoute() {
  vi.resetModules();
  return import("@/app/api/github/worker/route");
}

describe("POST /api/github/worker", () => {
  it("rejects unauthorized requests", async () => {
    process.env.CRON_SECRET = "secret";
    const { POST } = await loadRoute();
    const response = await POST(new Request("http://localhost/api/github/worker", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("processes queued scans for authorized workers", async () => {
    process.env.CRON_SECRET = "secret";
    processGitHubScanQueue.mockResolvedValue({ claimed: 2, succeeded: 2, failed: 0 });
    const { POST } = await loadRoute();
    const response = await POST(
      new Request("http://localhost/api/github/worker?batchSize=2", {
        method: "POST",
        headers: { authorization: "******", "x-worker-id": "worker-1" },
      })
    );
    expect(response.status).toBe(200);
    expect(processGitHubScanQueue).toHaveBeenCalledWith({ workerId: "worker-1", batchSize: 2 });
  });
});
