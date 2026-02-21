/**
 * Admin Jobs Routes for KPATA AI API
 * Job listing and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/jobs
 * List jobs with pagination and filters
 */
const listJobsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  status: z.string().optional(),
  profileId: z.string().uuid().optional(),
  category: z.string().optional(),
});

router.get(
  '/',
  requirePermission(PERMISSIONS.JOBS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { limit, offset, status, profileId, category } = listJobsSchema.parse(req.query);
      const supabase = getSupabaseClient();

      let query = supabase
        .from('jobs')
        .select('*, profiles(phone_e164)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      if (profileId) {
        query = query.eq('profile_id', profileId);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        jobs: data || [],
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
 * GET /admin/jobs/:id
 * Get job details
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
        .from('jobs')
        .select('*, profiles(id, phone_e164, role), assets(*)')
        .eq('id', req.params.id)
        .single();

      if (error || !data) {
        res.status(404).json({ error: { message: 'Job not found' } });
        return;
      }

      res.json({ job: data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
