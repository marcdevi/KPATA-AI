/**
 * Queue Client for KPATA AI API
 * Publishes jobs to BullMQ for worker processing
 */

import { QUEUE_NAMES, JOB_PRIORITIES, RETRY_CONFIG } from '@kpata/shared';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';


let redisConnection: Redis | null = null;
let jobQueue: Queue | null = null;

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

/**
 * Get job queue (singleton)
 */
export function getJobQueue(): Queue {
  if (!jobQueue) {
    jobQueue = new Queue(QUEUE_NAMES.JOBS, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: RETRY_CONFIG.MAX_ATTEMPTS,
        removeOnComplete: {
          count: 1000, // Keep last 1000 completed jobs
          age: 24 * 60 * 60, // Keep for 24 hours
        },
        removeOnFail: {
          count: 5000, // Keep more failed jobs for debugging
          age: 7 * 24 * 60 * 60, // Keep for 7 days
        },
      },
    });
  }
  return jobQueue;
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

/**
 * Publish a job to the queue
 */
export async function publishJob(payload: JobPayload): Promise<string> {
  const queue = getJobQueue();
  
  // Map priority string to BullMQ priority number
  const priorityMap: Record<string, number> = {
    low: JOB_PRIORITIES.LOW,
    normal: JOB_PRIORITIES.NORMAL,
    high: JOB_PRIORITIES.HIGH,
  };

  const job = await queue.add(
    'process-image', // Job name
    payload,
    {
      jobId: payload.jobId, // Use DB job ID as BullMQ job ID for idempotency
      priority: priorityMap[payload.priority] || JOB_PRIORITIES.NORMAL,
      attempts: RETRY_CONFIG.MAX_ATTEMPTS,
      backoff: {
        type: 'custom', // We'll handle backoff in worker
      },
    }
  );

  return job.id || payload.jobId;
}

/**
 * Get queue stats
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const queue = getJobQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Close queue connections gracefully
 */
export async function closeQueue(): Promise<void> {
  if (jobQueue) {
    await jobQueue.close();
    jobQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
