/**
 * Admin Dashboard Routes for KPATA AI API
 * Dashboard stats and overview
 */

import { Router, Request, Response, NextFunction } from 'express';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/dashboard/stats
 * Get dashboard statistics
 */
router.get(
  '/stats',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get active jobs (pending + queued + processing)
      const { count: activeJobs } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'queued', 'processing']);

      // Get today's revenue
      const { data: todayPayments } = await supabase
        .from('payments')
        .select('amount_xof')
        .eq('status', 'succeeded')
        .gte('created_at', today.toISOString());

      const todayRevenue = todayPayments?.reduce((sum, p) => sum + p.amount_xof, 0) || 0;

      // Get pending tickets
      const { count: pendingTickets } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress']);

      // Get queue stats
      const { data: queueJobs } = await supabase
        .from('jobs')
        .select('status')
        .in('status', ['pending', 'queued', 'processing', 'failed']);

      const queueStats = {
        waiting: queueJobs?.filter((j) => j.status === 'pending' || j.status === 'queued').length || 0,
        active: queueJobs?.filter((j) => j.status === 'processing').length || 0,
        failed: queueJobs?.filter((j) => j.status === 'failed').length || 0,
      };

      // Get recent activity
      const { data: recentLogs } = await supabase
        .from('admin_audit_logs')
        .select('id, action, target_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10);

      const recentActivity = recentLogs?.map((log) => ({
        id: log.id,
        type: log.action,
        description: `${log.action} on ${log.target_type}`,
        timestamp: log.created_at,
      })) || [];

      res.json({
        totalUsers: totalUsers || 0,
        activeJobs: activeJobs || 0,
        todayRevenue,
        pendingTickets: pendingTickets || 0,
        queueStats,
        recentActivity,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
