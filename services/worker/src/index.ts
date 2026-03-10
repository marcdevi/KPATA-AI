/**
 * KPATA AI Worker Service
 * BullMQ worker that processes image jobs
 */

import { QUEUE_NAMES, getBackoffDelay } from '@kpata/shared';
import { Worker } from 'bullmq';

import { getRedisConnection, closeConnection } from './lib/queue.js';
import { logger } from './logger.js';
import { processJob } from './processor.js';
import { processMannequinJob, MannequinJobPayload } from './mannequinProcessor.js';

let worker: Worker | null = null;
let mannequinWorker: Worker | null = null;

/**
 * Start the worker
 */
async function start(): Promise<void> {
  const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'REDIS_URL'];
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    logger.error('Missing required environment variables', {
      action: 'startup_error',
      meta: { missing },
    });
    process.exit(1);
  }

  logger.info('Worker service starting', {
    action: 'startup',
    meta: {
      nodeVersion: process.version,
      env: process.env.NODE_ENV || 'development',
      concurrency: process.env.WORKER_CONCURRENCY || '5',
    },
  });

  // Create and start main image processing worker
  const { createWorker } = await import('./lib/queue.js');
  worker = createWorker(processJob);

  // Create and start mannequin generation worker
  mannequinWorker = new Worker<MannequinJobPayload>(
    QUEUE_NAMES.MANNEQUIN_JOBS,
    async (job) => {
      await processMannequinJob(job.data);
    },
    {
      connection: getRedisConnection(),
      concurrency: 2, // Fewer concurrent mannequin jobs (they're heavy AI calls)
      settings: {
        backoffStrategy: (attemptsMade: number) => getBackoffDelay(attemptsMade),
      },
    }
  );

  // Event handlers for main worker
  worker.on('completed', (job) => {
    logger.info('Job completed', {
      action: 'job_completed',
      correlation_id: job.data.correlationId,
      meta: { jobId: job.data.jobId },
    });
  });

  worker.on('failed', (job, error) => {
    logger.error('Job failed', {
      action: 'job_failed',
      correlation_id: job?.data.correlationId,
      meta: {
        jobId: job?.data.jobId,
        error: error.message,
        attemptsMade: job?.attemptsMade,
      },
    });
  });

  worker.on('error', (error) => {
    logger.error('Worker error', {
      action: 'worker_error',
      meta: { error: error.message },
    });
  });

  // Event handlers for mannequin worker
  mannequinWorker.on('completed', (job) => {
    logger.info('Mannequin job completed', {
      action: 'mannequin_job_completed',
      correlation_id: job.data.correlationId,
      meta: { mannequinId: job.data.mannequinId },
    });
  });

  mannequinWorker.on('failed', (job, error) => {
    logger.error('Mannequin job failed', {
      action: 'mannequin_job_failed',
      correlation_id: job?.data.correlationId,
      meta: {
        mannequinId: job?.data.mannequinId,
        error: error.message,
      },
    });
  });

  logger.info('Worker started and listening for jobs', {
    action: 'worker_ready',
  });
}

/**
 * Graceful shutdown
 */
async function shutdown(): Promise<void> {
  logger.info('Worker shutting down...', { action: 'shutdown_start' });

  if (worker) {
    await worker.close();
    worker = null;
  }

  if (mannequinWorker) {
    await mannequinWorker.close();
    mannequinWorker = null;
  }

  await closeConnection();

  logger.info('Worker shutdown complete', { action: 'shutdown_complete' });
  process.exit(0);
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the worker
start().catch((error) => {
  logger.error('Failed to start worker', {
    action: 'startup_error',
    meta: { error: error.message },
  });
  process.exit(1);
});

export { logger, createLogger } from './logger.js';
