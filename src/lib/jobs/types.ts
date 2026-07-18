export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export interface Job {
  id: string;
  organizationId: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  priority: number;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnqueueJobInput {
  organizationId: string;
  createdBy: string;
  type: string;
  payload: Record<string, unknown>;
  priority: number;
  maxAttempts: number;
  runAfter: string;
}

export interface UpdateJobInput {
  status: JobStatus;
  attempts?: number;
  runAfter?: string;
  lastError?: string | null;
  lockedAt?: string | null;
  lockedBy?: string | null;
}
