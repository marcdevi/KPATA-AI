/**
 * Admin Queue Routes for KPATA AI API
 * BullMQ queue management
 */

import { Router, Request, Response, NextFunction } from 'express';

import { UnauthorizedError, NotFoundError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../logger.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/queue/status
 * Get queue status and jobs
 */
router.get(
  '/status',
  requirePermission(PERMISSIONS.JOBS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      // Get job counts by status
      const { data: statusCounts } = await supabase
        .from('jobs')
        .select('status')
        .in('status', ['queued', 'processing', 'delivered', 'failed']);

      const stats = {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };

      statusCounts?.forEach((job) => {
        if (job.status === 'queued') stats.waiting++;
        else if (job.status === 'processing') stats.active++;
        else if (job.status === 'delivered') stats.completed++;
        else if (job.status === 'failed') stats.failed++;
      });

      // Get waiting jobs
      const { data: waiting } = await supabase
        .from('jobs')
        .select('id, category, profile_id, created_at')
        .eq('status', 'queued')
        .order('created_at', { ascending: true })
        .limit(50);

      // Get active jobs
      const { data: active } = await supabase
        .from('jobs')
        .select('id, category, profile_id, attempt_count, created_at')
        .eq('status', 'processing')
        .order('created_at', { ascending: false })
        .limit(20);

      // Get failed jobs
      const { data: failed } = await supabase
        .from('jobs')
        .select('id, category, profile_id, attempt_count, error_message, created_at')
        .eq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(50);

      res.json({
        stats,
        waiting: waiting?.map((j) => ({
          id: j.id,
          name: 'process-image',
          data: { jobId: j.id, profileId: j.profile_id, category: j.category },
          timestamp: new Date(j.created_at).getTime(),
          attemptsMade: 0,
          priority: 0,
          state: 'waiting',
        })) || [],
        active: active?.map((j) => ({
          id: j.id,
          name: 'process-image',
          data: { jobId: j.id, profileId: j.profile_id, category: j.category },
          timestamp: new Date(j.created_at).getTime(),
          attemptsMade: j.attempt_count || 0,
          priority: 0,
          state: 'active',
        })) || [],
        failed: failed?.map((j) => ({
          id: j.id,
          name: 'process-image',
          data: { jobId: j.id, profileId: j.profile_id, category: j.category },
          timestamp: new Date(j.created_at).getTime(),
          attemptsMade: j.attempt_count || 0,
          priority: 0,
          state: 'failed',
          failedReason: j.error_message,
        })) || [],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/queue/retry/:jobId
 * Retry a failed job
 */
router.post(
  '/retry/:jobId',
  requirePermission(PERMISSIONS.JOBS_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { jobId } = req.params;
      const supabase = getSupabaseClient();

      // Reset job status to queued
      const { data, error } = await supabase
        .from('jobs')
        .update({
          status: 'queued',
          error_message: null,
          attempt_count: 0,
        })
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'job_retry',
        target_type: 'job',
        target_id: jobId,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('Job retried', {
        action: 'job_retried',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { jobId },
      });

      res.json({ success: true, job: data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/queue/cancel/:jobId
 * Cancel a queued job
 */
router.post(
  '/cancel/:jobId',
  requirePermission(PERMISSIONS.JOBS_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { jobId } = req.params;
      const supabase = getSupabaseClient();

      // First check if job exists and get its current status
      const { data: existingJob, error: fetchError } = await supabase
        .from('jobs')
        .select('id, status')
        .eq('id', jobId)
        .single();

      if (fetchError || !existingJob) {
        throw new NotFoundError('Job not found');
      }

      // Check if job can be cancelled
      if (!['queued', 'processing'].includes(existingJob.status)) {
        throw new Error(`Cannot cancel job with status: ${existingJob.status}. Only queued or processing jobs can be cancelled.`);
      }

      // Update job status to cancelled
      const { data, error } = await supabase
        .from('jobs')
        .update({
          status: 'cancelled',
          error_message: 'Cancelled by admin',
        })
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'job_cancel',
        target_type: 'job',
        target_id: jobId,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      res.json({ success: true, job: data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/queue/prioritize/:jobId
 * Prioritize a queued job
 */
router.post(
  '/prioritize/:jobId',
  requirePermission(PERMISSIONS.JOBS_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { jobId } = req.params;
      const supabase = getSupabaseClient();

      // Update job priority (move to front of queue by setting created_at to past)
      const { data, error } = await supabase
        .from('jobs')
        .update({
          priority: 1,
        })
        .eq('id', jobId)
        .eq('status', 'queued')
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'job_prioritize',
        target_type: 'job',
        target_id: jobId,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      res.json({ success: true, job: data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
