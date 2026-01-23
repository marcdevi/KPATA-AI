/**
 * Job Processor for KPATA AI Worker
 * Main processing pipeline for image jobs
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { handleDeadLetter } from './lib/dlq.js';
import { ProcessorContext, NonRetryableError, shouldRetry } from './lib/queue.js';
import { createStageTimer } from './lib/stage.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

/**
 * Update job status in database
 */
async function updateJobStatus(
  jobId: string,
  status: string,
  extra?: Record<string, unknown>
): Promise<void> {
  const supabase = getSupabase();
  
  const updateData: Record<string, unknown> = {
    status,
    ...extra,
  };

  if (status === 'processing') {
    updateData.processing_started_at = new Date().toISOString();
  } else if (status === 'completed') {
    updateData.completed_at = new Date().toISOString();
  }

  await supabase
    .from('jobs')
    .update(updateData)
    .eq('id', jobId);
}

/**
 * Main job processor
 */
export async function processJob(ctx: ProcessorContext): Promise<void> {
  const { job, correlationId, attempt } = ctx;
  const { jobId, profileId, category, backgroundStyle } = job.data;

  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Processing job ${jobId} (attempt ${attempt})`);

  const timer = createStageTimer(jobId, correlationId);

  try {
    // Update status to processing
    await updateJobStatus(jobId, 'processing', { attempt_count: attempt });

    // Stage 1: Validate input
    await timer.withStage('validate', async () => {
      await validateInput(job.data, correlationId);
    });

    // Stage 2: Download input image
    await timer.withStage('download', async () => {
      await downloadInputImage(jobId, correlationId);
    });

    // Stage 3: Process with AI (NOOP for MVP skeleton)
    await timer.withStage('ai_process', async () => {
      await processWithAI(jobId, category, backgroundStyle, correlationId);
    });

    // Stage 4: Upload result
    await timer.withStage('upload', async () => {
      await uploadResult(jobId, profileId, correlationId);
    });

    // Stage 5: Generate thumbnail
    await timer.withStage('thumbnail', async () => {
      await generateThumbnail(jobId, correlationId);
    });

    // Save stage durations
    await timer.saveDurations();

    // Update status to completed
    await updateJobStatus(jobId, 'completed', {
      stage_durations: timer.getDurations(),
      duration_ms_total: timer.getTotalDuration(),
    });

    // eslint-disable-next-line no-console
    console.log(`[${correlationId}] Job ${jobId} completed in ${timer.getTotalDuration()}ms`);

  } catch (error) {
    // Save durations even on failure
    await timer.saveDurations();

    // Check if we should retry
    if (error instanceof Error) {
      const canRetry = shouldRetry(error, attempt);

      if (!canRetry || attempt >= 3) {
        // Move to DLQ
        await handleDeadLetter(job, error, correlationId);
      } else {
        // Update job with error info for retry
        await updateJobStatus(jobId, 'queued', {
          last_error_code: 'errorCode' in error ? error.errorCode : 'PROCESSING_ERROR',
          last_error_message: error.message,
          attempt_count: attempt,
        });
      }
    }

    throw error; // Re-throw to let BullMQ handle retry
  }
}

/**
 * Stage: Validate input data
 */
async function validateInput(
  data: ProcessorContext['job']['data'],
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Validating input...`);

  // Check required fields
  if (!data.jobId || !data.profileId) {
    throw new NonRetryableError('Missing required fields', 'VALIDATION_FAILED');
  }

  // Simulate validation delay
  await sleep(50);
}

/**
 * Stage: Download input image from R2
 */
async function downloadInputImage(
  _jobId: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Downloading input image...`);

  // TODO: Implement actual R2 download
  // For MVP skeleton, just simulate
  await sleep(100);
}

/**
 * Stage: Process image with AI
 */
async function processWithAI(
  _jobId: string,
  category: string,
  backgroundStyle: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Processing with AI: category=${category}, style=${backgroundStyle}...`);

  // TODO: Implement actual AI processing
  // For MVP skeleton, just simulate with NOOP
  await sleep(200);
}

/**
 * Stage: Upload result to R2
 */
async function uploadResult(
  _jobId: string,
  _profileId: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Uploading result...`);

  // TODO: Implement actual R2 upload
  // For MVP skeleton, just simulate
  await sleep(100);
}

/**
 * Stage: Generate thumbnail
 */
async function generateThumbnail(
  _jobId: string,
  correlationId: string
): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Generating thumbnail...`);

  // TODO: Implement actual thumbnail generation
  // For MVP skeleton, just simulate
  await sleep(50);
}

/**
 * Helper: Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
