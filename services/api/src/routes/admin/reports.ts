/**
 * Admin Content Reports Routes for KPATA AI API
 * View and manage content reports
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../logger.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/reports
 * List content reports with pagination and filters
 */
const listReportsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
  status: z.enum(['pending', 'reviewing', 'resolved_valid', 'resolved_invalid', 'dismissed', 'all']).optional().default('all'),
  reason: z.enum(['nsfw', 'violence', 'hate_speech', 'spam', 'copyright', 'other', 'all']).optional().default('all'),
});

router.get(
  '/',
  requirePermission(PERMISSIONS.TICKETS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { limit, offset, status, reason } = listReportsSchema.parse(req.query);
      const supabase = getSupabaseClient();

      let query = supabase
        .from('content_reports')
        .select(`
          *,
          reporter:profiles!content_reports_reporter_id_fkey(id, phone_e164),
          reported_job:jobs(id, category, status),
          reported_profile:profiles!content_reports_reported_profile_id_fkey(id, phone_e164, status)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (reason !== 'all') {
        query = query.eq('reason', reason);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        reports: data || [],
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
 * GET /admin/reports/stats/summary
 * Get report statistics
 * NOTE: Must be defined BEFORE /:id to prevent 'stats' matching as an :id param
 */
router.get(
  '/stats/summary',
  requirePermission(PERMISSIONS.TICKETS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      // Get counts by status
      const { data: byStatus } = await supabase
        .from('content_reports')
        .select('status');

      const statusCounts: Record<string, number> = {};
      for (const row of byStatus || []) {
        statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      }

      // Get counts by reason
      const { data: byReason } = await supabase
        .from('content_reports')
        .select('reason')
        .eq('status', 'pending');

      const reasonCounts: Record<string, number> = {};
      for (const row of byReason || []) {
        reasonCounts[row.reason] = (reasonCounts[row.reason] || 0) + 1;
      }

      res.json({
        stats: {
          byStatus: statusCounts,
          pendingByReason: reasonCounts,
          totalPending: statusCounts['pending'] || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/reports/:id
 * Get single report details
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.TICKETS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('content_reports')
        .select(`
          *,
          reporter:profiles!content_reports_reporter_id_fkey(id, phone_e164, role),
          reported_job:jobs(*),
          reported_asset:assets(*),
          reported_profile:profiles!content_reports_reported_profile_id_fkey(id, phone_e164, role, status, violation_count),
          reviewer:profiles!content_reports_reviewed_by_fkey(id, phone_e164)
        `)
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        res.status(404).json({ error: { message: 'Report not found' } });
        return;
      }

      res.json({ report: data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/reports/:id
 * Update report status
 */
const updateReportSchema = z.object({
  status: z.enum(['reviewing', 'resolved_valid', 'resolved_invalid', 'dismissed']),
  reviewNotes: z.string().max(1000).optional(),
  actionTaken: z.string().max(500).optional(),
});

router.patch(
  '/:id',
  requirePermission(PERMISSIONS.TICKETS_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = updateReportSchema.parse(req.body);
      const correlationId = req.correlationId;
      const supabase = getSupabaseClient();

      const updateData: Record<string, unknown> = {
        status: input.status,
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
      };

      if (input.reviewNotes) {
        updateData.review_notes = input.reviewNotes;
      }

      if (input.actionTaken) {
        updateData.action_taken = input.actionTaken;
      }

      const { data, error } = await supabase
        .from('content_reports')
        .update(updateData)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Content report updated', {
        action: 'content_report_updated',
        correlation_id: correlationId,
        user_id: req.user.id,
        meta: {
          reportId: req.params.id,
          newStatus: input.status,
        },
      });

      res.json({ report: data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
