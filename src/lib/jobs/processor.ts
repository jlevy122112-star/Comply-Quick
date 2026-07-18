import { createJobQueue, type JobQueue } from "./service";
import type { Job } from "./types";

export type JobHandler = (job: Job) => Promise<void>;
export type JobHandlers = Record<string, JobHandler>;

export interface ProcessJobsOptions {
  queue?: JobQueue;
  workerId: string;
  batchSize?: number;
}

export interface ProcessJobsResult {
  claimed: number;
  succeeded: number;
  failed: number;
}

export async function processJobs(handlers: JobHandlers, options: ProcessJobsOptions): Promise<ProcessJobsResult> {
  const queue = options.queue ?? createJobQueue();
  const jobs = await queue.claimBatch(options.workerId, options.batchSize);
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      const handler = handlers[job.type];
      if (!handler) throw new Error(`No handler registered for job type "${job.type}".`);
      await handler(job);
      await queue.completeJob(job.id);
      succeeded += 1;
    } catch (error) {
      await queue.failJob(job.id, error);
      failed += 1;
    }
  }

  return { claimed: jobs.length, succeeded, failed };
}

/** Minimal example handler for wiring and smoke tests. */
export const exampleJobHandler: JobHandler = async () => {};
