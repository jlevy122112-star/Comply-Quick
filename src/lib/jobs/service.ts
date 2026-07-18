import { createClient } from "@/lib/supabase/server";
import { getActiveOrganizationId } from "@/lib/organizations-db";
import { createJobBackend, type JobBackend } from "./backend";
import type { Job } from "./types";

export const JOB_CONCURRENCY_BY_TIER = {
  free: 1,
  solo: 1,
  agency: 5,
  enterprise: 1_000_000,
} as const;
// The org_job_concurrency_limit SQL helper must mirror this map.

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_PRIORITY = 0;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_STALE_JOB_TIMEOUT_MS = 5 * 60 * 1_000;

export interface EnqueueOptions {
  priority?: number;
  maxAttempts?: number;
  runAfter?: Date;
}

export interface JobQueueOptions {
  backend?: JobBackend;
  retryDelayMs?: number;
  staleJobTimeoutMs?: number;
}

async function requireContext(): Promise<{ organizationId: string; userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to use the job queue.");
  const organizationId = await getActiveOrganizationId();
  if (!organizationId) throw new Error("Select an organization to use the job queue.");
  return { organizationId, userId: user.id };
}

export class JobQueue {
  private readonly backend: JobBackend;
  private readonly retryDelayMs: number;
  private readonly staleJobTimeoutMs: number;

  constructor(options: JobQueueOptions = {}) {
    this.backend = options.backend ?? createJobBackend();
    this.retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.staleJobTimeoutMs = options.staleJobTimeoutMs ?? DEFAULT_STALE_JOB_TIMEOUT_MS;
  }

  async enqueue(type: string, payload: Record<string, unknown>, options: EnqueueOptions = {}): Promise<Job> {
    if (!type.trim()) throw new Error("A job type is required.");
    const { organizationId, userId } = await requireContext();
    const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error("maxAttempts must be a positive integer.");
    }
    return this.backend.enqueue({
      organizationId,
      createdBy: userId,
      type,
      payload,
      priority: options.priority ?? DEFAULT_PRIORITY,
      maxAttempts,
      runAfter: (options.runAfter ?? new Date()).toISOString(),
    });
  }

  async claimBatch(workerId: string, batchSize = 10): Promise<Job[]> {
    if (!workerId.trim()) throw new Error("A worker id is required.");
    if (!Number.isInteger(batchSize) || batchSize <= 0) throw new Error("batchSize must be positive.");
    await this.backend.reclaimStale(this.staleJobTimeoutMs);
    return this.backend.claimBatch(workerId, batchSize);
  }

  async reclaimStale(timeoutMs = this.staleJobTimeoutMs): Promise<number> {
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error("timeoutMs must be positive.");
    }
    return this.backend.reclaimStale(timeoutMs);
  }

  async completeJob(id: string): Promise<Job> {
    return this.backend.update(id, {
      status: "succeeded",
      lastError: null,
      lockedAt: null,
      lockedBy: null,
    });
  }

  async failJob(id: string, error: unknown): Promise<Job> {
    const current = await this.findJobForUpdate(id);
    if (!current) throw new Error("Job not found.");
    const attempts = current.attempts + 1;
    const message = error instanceof Error ? error.message : String(error);
    if (attempts >= current.maxAttempts) {
      return this.backend.update(id, {
        status: "failed",
        attempts,
        lastError: message,
        lockedAt: null,
        lockedBy: null,
      });
    }

    const delay = this.retryDelayMs * 2 ** Math.max(0, current.attempts);
    return this.backend.update(id, {
      status: "queued",
      attempts,
      runAfter: new Date(Date.now() + delay).toISOString(),
      lastError: message,
      lockedAt: null,
      lockedBy: null,
    });
  }

  async listOrgJobs(): Promise<Job[]> {
    const { organizationId } = await requireContext();
    return this.backend.listOrgJobs(organizationId);
  }

  async getJob(id: string): Promise<Job | null> {
    const { organizationId } = await requireContext();
    return this.backend.getJob(organizationId, id);
  }

  private async findJobForUpdate(id: string): Promise<Job | null> {
    const { organizationId } = await requireContext();
    return this.backend.getJob(organizationId, id);
  }
}

export function createJobQueue(options: JobQueueOptions = {}): JobQueue {
  return new JobQueue(options);
}
