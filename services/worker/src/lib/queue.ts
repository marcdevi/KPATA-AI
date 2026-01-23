/**
 * Queue Consumer for KPATA AI Worker
 * Consumes jobs from BullMQ
 */

import { QUEUE_NAMES, RETRY_CONFIG, getBackoffDelay, isRetryableError } from '@kpata/shared';
import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';


let redisConnection: Redis | null = null;

/**
 * Get Redis connection (singleton)
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    redisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null, // Required for BullMQ
      enableReadyCheck: false,
    });
  }
  return redisConnection;
}

export interface JobPayload {
  jobId: string;
  profileId: string;
  correlationId: string;
  priority: 'low' | 'normal' | 'high';
  category: string;
  backgroundStyle: string;
  templateLayout: string;
  mannequinMode: string;
  sourceChannel: string;
}

export interface ProcessorContext {
  job: Job<JobPayload>;
  correlationId: string;
  attempt: number;
}

export type JobProcessor = (ctx: ProcessorContext) => Promise<void>;

/**
 * Create a worker that processes jobs
 */
export function createWorker(processor: JobProcessor): Worker<JobPayload> {
  const worker = new Worker<JobPayload>(
    QUEUE_NAMES.JOBS,
    async (job) => {
      const ctx: ProcessorContext = {
        job,
        correlationId: job.data.correlationId,
        attempt: job.attemptsMade + 1,
      };

      await processor(ctx);
    },
    {
      connection: getRedisConnection(),
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return getBackoffDelay(attemptsMade);
        },
      },
    }
  );

  return worker;
}

/**
 * Error class for non-retryable errors
 */
export class NonRetryableError extends Error {
  public readonly errorCode: string;
  public readonly statusCode: number;

  constructor(message: string, errorCode: string, statusCode = 400) {
    super(message);
    this.name = 'NonRetryableError';
    this.errorCode = errorCode;
    this.statusCode = statusCode;
  }
}

/**
 * Check if error should be retried
 */
export function shouldRetry(error: Error, attemptsMade: number): boolean {
  // Non-retryable errors
  if (error instanceof NonRetryableError) {
    return false;
  }

  // Check error code if available
  if ('errorCode' in error && typeof error.errorCode === 'string') {
    if (!isRetryableError(error.errorCode)) {
      return false;
    }
  }

  // Max attempts reached
  if (attemptsMade >= RETRY_CONFIG.MAX_ATTEMPTS) {
    return false;
  }

  return true;
}

/**
 * Close Redis connection
 */
export async function closeConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
