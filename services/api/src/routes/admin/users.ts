/**
 * Admin Users Routes for KPATA AI API
 * User search, profile 360°, ban management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, NotFoundError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../logger.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/users
 * Search and list users with pagination
 */
const listUsersSchema = z.object({
  search: z.string().optional().default(''),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  role: z.string().optional(),
  status: z.string().optional(),
});

router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { search, limit, offset, role, status } = listUsersSchema.parse(req.query);
      const supabase = getSupabaseClient();

      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`phone_e164.ilike.%${search}%,name.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      if (status) {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        profiles: data || [],
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
 * GET /admin/users/:id
 * Get user profile 360° view
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.USERS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const profileId = req.params.id;
      const supabase = getSupabaseClient();

      // Get profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (profileError || !profile) {
        throw new NotFoundError('Profile not found');
      }

      // Get credit balance
      const { data: balance } = await supabase.rpc('get_credit_balance', {
        p_profile_id: profileId,
      });

      // Get recent transactions
      const { data: recentTransactions } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get recent jobs
      const { data: recentJobs } = await supabase
        .from('jobs')
        .select('id, status, category, background_style, created_at, duration_ms_total')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);

      // Get payments
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20);

      res.json({
        profile,
        credits: {
          balance: balance || 0,
        },
        recentTransactions: recentTransactions || [],
        recentJobs: recentJobs || [],
        payments: payments || [],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/users/:id/ban
 * Ban a user
 */
const banUserSchema = z.object({
  reason: z.string().min(10).max(500),
});

router.post(
  '/:id/ban',
  requirePermission(PERMISSIONS.USERS_BAN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { reason } = banUserSchema.parse(req.body);
      const profileId = req.params.id;
      const supabase = getSupabaseClient();

      // Update profile status
      const { data: profile, error } = await supabase
        .from('profiles')
        .update({
          status: 'banned',
          ban_reason: reason,
        })
        .eq('id', profileId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Create audit log
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'user_ban',
        target_type: 'profile',
        target_id: profileId,
        reason,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('User banned', {
        action: 'user_banned',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { targetProfileId: profileId, reason },
      });

      res.json({ profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/users/:id/unban
 * Unban a user
 */
router.post(
  '/:id/unban',
  requirePermission(PERMISSIONS.USERS_BAN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const profileId = req.params.id;
      const supabase = getSupabaseClient();

      const { data: profile, error } = await supabase
        .from('profiles')
        .update({
          status: 'active',
          ban_reason: null,
        })
        .eq('id', profileId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Create audit log
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'user_unban',
        target_type: 'profile',
        target_id: profileId,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      res.json({ profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/users/pending
 * List users with pending_approval status
 */
router.get(
  '/pending',
  requirePermission(PERMISSIONS.USERS_BAN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      const { data, count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      res.json({
        profiles: data || [],
        total: count || 0,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/users/:id/approve
 * Approve a pending user
 */
router.post(
  '/:id/approve',
  requirePermission(PERMISSIONS.USERS_BAN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const profileId = req.params.id;
      const supabase = getSupabaseClient();

      const { data: profile, error } = await supabase
        .from('profiles')
        .update({ status: 'active' })
        .eq('id', profileId)
        .eq('status', 'pending_approval')
        .select()
        .single();

      if (error || !profile) {
        throw new NotFoundError('Pending profile not found');
      }

      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'user_approve',
        target_type: 'profile',
        target_id: profileId,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('User approved', {
        action: 'user_approved',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { targetProfileId: profileId },
      });

      res.json({ profile });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/users/:id/reject
 * Reject (ban) a pending user
 */
const rejectUserSchema = z.object({
  reason: z.string().min(1).max(500).optional().default('Account rejected during review'),
});

router.post(
  '/:id/reject',
  requirePermission(PERMISSIONS.USERS_BAN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { reason } = rejectUserSchema.parse(req.body);
      const profileId = req.params.id;
      const supabase = getSupabaseClient();

      const { data: profile, error } = await supabase
        .from('profiles')
        .update({ status: 'banned', ban_reason: reason })
        .eq('id', profileId)
        .eq('status', 'pending_approval')
        .select()
        .single();

      if (error || !profile) {
        throw new NotFoundError('Pending profile not found');
      }

      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'user_reject',
        target_type: 'profile',
        target_id: profileId,
        reason,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('User rejected', {
        action: 'user_rejected',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { targetProfileId: profileId, reason },
      });

      res.json({ profile });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
