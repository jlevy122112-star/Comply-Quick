import { createAdminClient } from "@/lib/supabase/admin";
import type { EnqueueJobInput, Job, UpdateJobInput } from "./types";

export interface JobBackend {
  enqueue(input: EnqueueJobInput): Promise<Job>;
  claimBatch(workerId: string, batchSize: number, perOrgLimit: number): Promise<Job[]>;
  update(id: string, input: UpdateJobInput): Promise<Job>;
  listOrgJobs(organizationId: string): Promise<Job[]>;
  getJob(organizationId: string, id: string): Promise<Job | null>;
}

interface JobRow {
  id: string;
  organization_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: Job["status"];
  priority: number;
  attempts: number;
  max_attempts: number;
  run_after: string;
  locked_at: string | null;
  locked_by: string | null;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

const JOB_COLUMNS =
  "id, organization_id, type, payload, status, priority, attempts, max_attempts, run_after, locked_at, locked_by, last_error, created_by, created_at, updated_at";

function mapJob(row: JobRow): Job {
  return {
    id: row.id,
    organizationId: row.organization_id,
    type: row.type,
    payload: row.payload ?? {},
    status: row.status,
    priority: row.priority,
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    lockedAt: row.locked_at,
    lockedBy: row.locked_by,
    lastError: row.last_error,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresJobBackend implements JobBackend {
  private readonly admin = createAdminClient();

  async enqueue(input: EnqueueJobInput): Promise<Job> {
    const { data, error } = await this.admin
      .from("jobs")
      .insert({
        organization_id: input.organizationId,
        created_by: input.createdBy,
        type: input.type,
        payload: input.payload,
        priority: input.priority,
        max_attempts: input.maxAttempts,
        run_after: input.runAfter,
      })
      .select(JOB_COLUMNS)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not enqueue job.");
    return mapJob(data as JobRow);
  }

  async claimBatch(workerId: string, batchSize: number, perOrgLimit: number): Promise<Job[]> {
    const { data, error } = await this.admin.rpc("claim_jobs", {
      worker_id: workerId,
      batch_size: batchSize,
      per_org_limit: perOrgLimit,
    });
    if (error) throw new Error(error.message);
    return ((data ?? []) as JobRow[]).map(mapJob);
  }

  async update(id: string, input: UpdateJobInput): Promise<Job> {
    const { data, error } = await this.admin
      .from("jobs")
      .update({
        status: input.status,
        ...(input.attempts === undefined ? {} : { attempts: input.attempts }),
        ...(input.runAfter === undefined ? {} : { run_after: input.runAfter }),
        ...(input.lastError === undefined ? {} : { last_error: input.lastError }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(JOB_COLUMNS)
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not update job.");
    return mapJob(data as JobRow);
  }

  async listOrgJobs(organizationId: string): Promise<Job[]> {
    const { data, error } = await this.admin
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as JobRow[]).map(mapJob);
  }

  async getJob(organizationId: string, id: string): Promise<Job | null> {
    const { data, error } = await this.admin
      .from("jobs")
      .select(JOB_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? mapJob(data as JobRow) : null;
  }
}

export function createJobBackend(): JobBackend {
  return new PostgresJobBackend();
}
