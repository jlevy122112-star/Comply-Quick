import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JobBackend } from "@/lib/jobs/backend";
import { PostgresJobBackend } from "@/lib/jobs/backend";
import { createJobQueue, JobQueue } from "@/lib/jobs/service";
import { exampleJobHandler, processJobs } from "@/lib/jobs/processor";
import type { Job } from "@/lib/jobs/types";

const state = vi.hoisted(() => ({
  activeOrganizationId: "org-a",
  userId: "user-a",
  tier: "agency" as "free" | "solo" | "agency" | "enterprise",
  admin: {
    rpc: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: state.userId } } }) },
  }),
}));

vi.mock("@/lib/organizations-db", () => ({
  getActiveOrganizationId: async () => state.activeOrganizationId,
}));

vi.mock("@/lib/entitlements", () => ({
  getOrgEntitlement: async () => ({
    tier: state.tier,
    isPremium: state.tier !== "free",
    isEnterprise: state.tier === "enterprise",
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => state.admin,
}));

function job(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    organizationId: "org-a",
    type: "example",
    payload: { value: 1 },
    status: "running",
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    runAfter: "2026-01-01T00:00:00.000Z",
    lockedAt: "2026-01-01T00:00:00.000Z",
    lockedBy: "worker-1",
    lastError: null,
    createdBy: "user-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function fakeBackend(initial: Job[] = []): JobBackend & {
  jobs: Map<string, Job>;
  calls: {
    reclaim?: number;
    claim?: [string, number];
    enqueue?: Parameters<JobBackend["enqueue"]>[0];
  };
} {
  const jobs = new Map(initial.map((item) => [item.id, item]));
  const calls: {
    reclaim?: number;
    claim?: [string, number];
    enqueue?: Parameters<JobBackend["enqueue"]>[0];
  } = {};
  return {
    jobs,
    calls,
    enqueue: vi.fn(async (input) => {
      calls.enqueue = input;
      const created = job({
        id: "enqueued",
        organizationId: input.organizationId,
        createdBy: input.createdBy,
        type: input.type,
        payload: input.payload,
        priority: input.priority,
        maxAttempts: input.maxAttempts,
        runAfter: input.runAfter,
        status: "queued",
      });
      jobs.set(created.id, created);
      return created;
    }),
    reclaimStale: vi.fn(async (timeoutMs) => {
      calls.reclaim = timeoutMs;
      for (const [id, current] of jobs) {
        if (id === "stale" && current.status === "running") {
          jobs.set(id, { ...current, status: "queued", lockedAt: null, lockedBy: null });
        }
      }
      return 1;
    }),
    claimBatch: vi.fn(async (workerId, batchSize) => {
      calls.claim = [workerId, batchSize];
      return [...jobs.values()].slice(0, batchSize);
    }),
    update: vi.fn(async (id, input) => {
      const current = jobs.get(id);
      if (!current) throw new Error("missing");
      const updated = { ...current, ...input };
      jobs.set(id, updated);
      return updated;
    }),
    listOrgJobs: vi.fn(async (organizationId) =>
      [...jobs.values()].filter((item) => item.organizationId === organizationId)
    ),
    getJob: vi.fn(async (organizationId, id) => {
      const current = jobs.get(id);
      return current && current.organizationId === organizationId ? current : null;
    }),
  };
}

describe("Postgres job queue", () => {
  beforeEach(() => {
    state.activeOrganizationId = "org-a";
    state.userId = "user-a";
    state.tier = "agency";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enqueues a job tagged with the active organization and caller", async () => {
    const backend = fakeBackend();
    const queue = createJobQueue({ backend });

    await queue.enqueue("scan", { projectId: "project-1" }, { priority: 4, maxAttempts: 5 });

    expect(backend.calls.enqueue).toMatchObject({
      organizationId: "org-a",
      createdBy: "user-a",
      type: "scan",
      payload: { projectId: "project-1" },
      priority: 4,
      maxAttempts: 5,
    });
  });

  it("reclaims stale jobs before calling the atomic claim RPC", async () => {
    const backend = fakeBackend([
      job({ id: "org-a-high", organizationId: "org-a", priority: 10 }),
      job({ id: "org-b", organizationId: "org-b", priority: 9 }),
    ]);
    const queue = createJobQueue({ backend });

    const claimed = await queue.claimBatch("worker-1", 2);

    expect(backend.calls.reclaim).toBe(300_000);
    expect(backend.calls.claim).toEqual(["worker-1", 2]);
    expect(claimed.map((item) => item.id)).toEqual(["org-a-high", "org-b"]);
  });

  it("keeps different organizations on their own tier caps in one claim", async () => {
    const freeJobs = Array.from({ length: 3 }, (_, index) =>
      job({ id: `free-${index + 1}`, organizationId: "org-free", status: "queued" })
    );
    const agencyJobs = Array.from({ length: 7 }, (_, index) =>
      job({ id: `agency-${index + 1}`, organizationId: "org-agency", status: "queued" })
    );
    const backend = fakeBackend([...freeJobs, ...agencyJobs]);
    backend.claimBatch = vi.fn(async (workerId, batchSize) => {
      backend.calls.claim = [workerId, batchSize];
      const limits = new Map([
        ["org-free", 1],
        ["org-agency", 5],
      ]);
      const running = new Map<string, number>();
      return [...freeJobs, ...agencyJobs]
        .filter((item) => {
          const count = running.get(item.organizationId) ?? 0;
          const allowed = count < (limits.get(item.organizationId) ?? 1);
          if (allowed) running.set(item.organizationId, count + 1);
          return allowed;
        })
        .slice(0, batchSize);
    });
    const queue = createJobQueue({ backend });

    const claimed = await queue.claimBatch("worker-1", 10);

    expect(backend.calls.claim).toEqual(["worker-1", 10]);
    expect(claimed.filter((item) => item.organizationId === "org-free")).toHaveLength(1);
    expect(claimed.filter((item) => item.organizationId === "org-agency")).toHaveLength(5);
  });

  it("retries failures with exponential backoff and eventually marks them failed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const first = job({ id: "retry", attempts: 0, maxAttempts: 3 });
    const backend = fakeBackend([first]);
    const queue = new JobQueue({ backend, retryDelayMs: 1_000 });

    const retried = await queue.failJob("retry", new Error("temporary"));
    expect(retried.status).toBe("queued");
    expect(retried.attempts).toBe(1);
    expect(retried.lastError).toBe("temporary");
    expect(retried.runAfter).toBe("2026-01-01T00:00:01.000Z");
    expect(retried.lockedAt).toBeNull();
    expect(retried.lockedBy).toBeNull();

    const failed = await queue.failJob("retry", "permanent");
    await queue.failJob("retry", "permanent");
    expect(failed.status).toBe("queued");
    expect(backend.jobs.get("retry")?.status).toBe("failed");
    expect(backend.jobs.get("retry")?.attempts).toBe(3);
  });

  it("reclaims stale running jobs and clears their lock metadata", async () => {
    const backend = fakeBackend([job({ id: "stale", status: "running" })]);
    const queue = createJobQueue({ backend });

    const reclaimed = await queue.reclaimStale(120_000);

    expect(reclaimed).toBe(1);
    expect(backend.calls.reclaim).toBe(120_000);
    expect(backend.jobs.get("stale")).toMatchObject({
      status: "queued",
      lockedAt: null,
      lockedBy: null,
    });
  });

  it("completes jobs and scopes observability reads to the active organization", async () => {
    const backend = fakeBackend([job({ id: "org-a-job" }), job({ id: "org-b-job", organizationId: "org-b" })]);
    const queue = createJobQueue({ backend });

    const completed = await queue.completeJob("org-a-job");
    const listed = await queue.listOrgJobs();
    const hidden = await queue.getJob("org-b-job");

    expect(completed.status).toBe("succeeded");
    expect(listed.map((item) => item.id)).toEqual(["org-a-job"]);
    expect(hidden).toBeNull();
  });

  it("maps jobs returned by the priority/FIFO fairness RPC", async () => {
    state.admin.rpc.mockResolvedValue({
      data: [
        {
          id: "high",
          organization_id: "org-a",
          type: "scan",
          payload: {},
          status: "running",
          priority: 10,
          attempts: 0,
          max_attempts: 3,
          run_after: "2026-01-01T00:00:00.000Z",
          locked_at: null,
          locked_by: "worker",
          last_error: null,
          created_by: "user-a",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "other-tenant",
          organization_id: "org-b",
          type: "scan",
          payload: {},
          status: "running",
          priority: 9,
          attempts: 0,
          max_attempts: 3,
          run_after: "2026-01-01T00:00:01.000Z",
          locked_at: null,
          locked_by: "worker",
          last_error: null,
          created_by: "user-b",
          created_at: "2026-01-01T00:00:01.000Z",
          updated_at: "2026-01-01T00:00:01.000Z",
        },
      ],
      error: null,
    });

    const backend = new PostgresJobBackend();
    const claimed = await backend.claimBatch("worker", 2);

    expect(state.admin.rpc).toHaveBeenCalledWith("claim_jobs", {
      worker_id: "worker",
      batch_size: 2,
    });
    expect(claimed.map((item) => item.id)).toEqual(["high", "other-tenant"]);
  });

  it("calls the stale-job reclaim RPC in seconds", async () => {
    state.admin.rpc.mockResolvedValue({ data: 2, error: null });
    const backend = new PostgresJobBackend();

    await expect(backend.reclaimStale(120_500)).resolves.toBe(2);

    expect(state.admin.rpc).toHaveBeenCalledWith("reclaim_stale_jobs", {
      timeout_seconds: 120,
    });
  });
});

describe("processJobs", () => {
  it("dispatches handlers and records completion or retryable failure", async () => {
    const queue = {
      claimBatch: vi.fn(async () => [job({ id: "ok", type: "example" }), job({ id: "bad", type: "missing" })]),
      completeJob: vi.fn(async () => job({ status: "succeeded" })),
      failJob: vi.fn(async () => job({ status: "queued", attempts: 1 })),
    } as unknown as JobQueue;

    const result = await processJobs({ example: exampleJobHandler }, { queue, workerId: "worker-1" });

    expect(result).toEqual({ claimed: 2, succeeded: 1, failed: 1 });
    expect(queue.completeJob).toHaveBeenCalledWith("ok");
    expect(queue.failJob).toHaveBeenCalledWith("bad", expect.any(Error));
  });
});
