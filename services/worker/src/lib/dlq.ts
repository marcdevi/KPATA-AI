/**
 * Dead Letter Queue (DLQ) Handler for KPATA AI Worker
 * Handles jobs that have failed all retry attempts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Job } from 'bullmq';

import { JobPayload } from './queue.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client (singleton)
 */
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

export interface FailedJobRecord {
  id: string;
  jobId: string;
  profileId: string;
  correlationId: string;
  errorCode: string;
  errorMessage: string;
  attemptCount: number;
  lastAttemptAt: Date;
  payload: JobPayload;
  stackTrace?: string;
}

/**
 * Handle a job that has permanently failed (DLQ)
 * - Records to jobs_failed_definitely table
 * - Updates job status to 'failed' (triggers auto-refund)
 * - Notifies user
 */
export async function handleDeadLetter(
  job: Job<JobPayload>,
  error: Error,
  correlationId: string
): Promise<void> {
  const supabase = getSupabase();
  const { jobId, profileId } = job.data;

  // Extract error code if available
  const errorCode = 'errorCode' in error ? String(error.errorCode) : 'UNKNOWN_ERROR';
  const errorMessage = error.message || 'Unknown error occurred';

  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] Job ${jobId} moved to DLQ after ${job.attemptsMade} attempts: ${errorMessage}`);

  // 1. Record to jobs_failed_definitely table
  const { error: insertError } = await supabase
    .from('jobs_failed_definitely')
    .upsert({
      job_id: jobId,
      profile_id: profileId,
      correlation_id: correlationId,
      error_code: errorCode,
      error_message: errorMessage,
      attempt_count: job.attemptsMade,
      last_attempt_at: new Date().toISOString(),
      payload: job.data,
      stack_trace: error.stack,
    }, {
      onConflict: 'job_id',
    });

  if (insertError) {
    // eslint-disable-next-line no-console
    console.error(`[${correlationId}] Failed to insert DLQ record:`, insertError);
  }

  // 2. Update job status to 'failed' (this triggers auto-refund via DB trigger)
  const { error: updateError } = await supabase
    .from('jobs')
    .update({
      status: 'failed',
      last_error_code: errorCode,
      last_error_message: errorMessage,
      attempt_count: job.attemptsMade,
    })
    .eq('id', jobId);

  if (updateError) {
    // eslint-disable-next-line no-console
    console.error(`[${correlationId}] Failed to update job status:`, updateError);
  }

  // 3. Queue user notification
  await notifyUserOfFailure(profileId, jobId, errorMessage, correlationId);
}

/**
 * Notify user that their job has failed
 */
async function notifyUserOfFailure(
  profileId: string,
  jobId: string,
  errorMessage: string,
  correlationId: string
): Promise<void> {
  // For MVP, we'll just log. In production, this would:
  // - Send push notification
  // - Send Telegram/WhatsApp message
  // - Send email
  
  // eslint-disable-next-line no-console
  console.log(`[${correlationId}] TODO: Notify user ${profileId} about failed job ${jobId}: ${errorMessage}`);

  // Could publish to notification queue:
  // await publishNotification({
  //   type: 'job_failed',
  //   profileId,
  //   jobId,
  //   message: errorMessage,
  // });
}

/**
 * Get failed jobs for admin view
 */
export async function getFailedJobs(options: {
  limit?: number;
  offset?: number;
  profileId?: string;
}): Promise<{ jobs: FailedJobRecord[]; total: number }> {
  const supabase = getSupabase();
  const { limit = 50, offset = 0, profileId } = options;

  let query = supabase
    .from('jobs_failed_definitely')
    .select('*', { count: 'exact' })
    .order('last_attempt_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (profileId) {
    query = query.eq('profile_id', profileId);
  }

  const { data, count, error } = await query;

  if (error) {
    throw error;
  }

  return {
    jobs: (data || []).map(row => ({
      id: row.id,
      jobId: row.job_id,
      profileId: row.profile_id,
      correlationId: row.correlation_id,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      attemptCount: row.attempt_count,
      lastAttemptAt: new Date(row.last_attempt_at),
      payload: row.payload,
      stackTrace: row.stack_trace,
    })),
    total: count || 0,
  };
}
