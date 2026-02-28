/**
 * Admin DLQ (Dead Letter Queue) Routes for KPATA AI API
 * View and manage permanently failed jobs
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/dlq
 * List failed jobs (DLQ) with pagination
 */
const listDlqSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  profileId: z.string().uuid().optional(),
  errorCode: z.string().optional(),
  reviewed: z.enum(['true', 'false', 'all']).optional().default('all'),
});

router.get(
  '/',
  requirePermission(PERMISSIONS.JOBS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { limit, offset, profileId, errorCode, reviewed } = listDlqSchema.parse(req.query);
      const supabase = getSupabaseClient();

      let query = supabase
        .from('jobs_failed_definitely')
        .select('*, jobs(category, background_style, source_channel)', { count: 'exact' })
        .order('last_attempt_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      if (errorCode) {
        query = query.eq('error_code', errorCode);
      }

      if (reviewed === 'true') {
        query = query.not('reviewed_at', 'is', null);
      } else if (reviewed === 'false') {
        query = query.is('reviewed_at', null);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        failedJobs: data || [],
        pagination: {
          total: count || 0,
          limit,
          offset,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/dlq/stats/summary
 * Get DLQ statistics
 * NOTE: Must be defined BEFORE /:id to prevent 'stats' matching as an :id param
 */
router.get(
  '/stats/summary',
  requirePermission(PERMISSIONS.JOBS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      // Get counts by error code
      const { data: byErrorCode } = await supabase
        .from('jobs_failed_definitely')
        .select('error_code')
        .is('reviewed_at', null);

      // Count by error code
      const errorCodeCounts: Record<string, number> = {};
      for (const row of byErrorCode || []) {
        errorCodeCounts[row.error_code] = (errorCodeCounts[row.error_code] || 0) + 1;
      }

      // Get total counts
      const { count: totalUnreviewed } = await supabase
        .from('jobs_failed_definitely')
        .select('*', { count: 'exact', head: true })
        .is('reviewed_at', null);

      const { count: totalReviewed } = await supabase
        .from('jobs_failed_definitely')
        .select('*', { count: 'exact', head: true })
        .not('reviewed_at', 'is', null);

      res.json({
        stats: {
          totalUnreviewed: totalUnreviewed || 0,
          totalReviewed: totalReviewed || 0,
          byErrorCode: errorCodeCounts,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/dlq/:id
 * Get single failed job details
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.JOBS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('jobs_failed_definitely')
        .select('*, jobs(*), profiles(id, phone_e164, role)')
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        res.status(404).json({ error: { message: 'Failed job not found' } });
        return;
      }

      res.json({ failedJob: data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/dlq/:id/review
 * Mark a failed job as reviewed
 */
const reviewSchema = z.object({
  notes: z.string().max(1000).optional(),
});

router.patch(
  '/:id/review',
  requirePermission(PERMISSIONS.JOBS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { notes } = reviewSchema.parse(req.body);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('jobs_failed_definitely')
        .update({
          reviewed_at: new Date().toISOString(),
          reviewed_by: req.user.id,
          review_notes: notes,
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      res.json({ failedJob: data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
