/**
 * Admin FinOps Routes for KPATA AI API
 * Cost vs revenue analytics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/finops
 * Get FinOps dashboard data
 */
const finopsSchema = z.object({
  period: z.enum(['7d', '30d', '90d']).optional().default('7d'),
});

router.get(
  '/',
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { period } = finopsSchema.parse(req.query);
      const supabase = getSupabaseClient();

      // Calculate date range
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get revenue from payments
      const { data: payments } = await supabase
        .from('payments')
        .select('amount_xof, created_at')
        .eq('status', 'succeeded')
        .gte('created_at', startDate.toISOString());

      // Get AI costs from jobs (estimated based on model usage)
      const { data: jobs } = await supabase
        .from('jobs')
        .select('model_used, duration_ms_total, created_at, status')
        .gte('created_at', startDate.toISOString());

      // Calculate totals
      const totalRevenue = payments?.reduce((sum, p) => sum + p.amount_xof, 0) || 0;

      // Estimate costs: ~50 FCFA per job on average (simplified)
      const completedJobs = jobs?.filter((j) => j.status === 'completed' || j.status === 'delivered') || [];
      const totalCost = completedJobs.length * 50;

      const margin = totalRevenue - totalCost;
      const marginPercent = totalRevenue > 0 ? (margin / totalRevenue) * 100 : 0;
      const marginAlert = marginPercent < 20;

      // Daily stats
      const dailyStats: Record<string, { revenue: number; cost: number }> = {};

      payments?.forEach((p) => {
        const date = p.created_at.split('T')[0];
        if (!dailyStats[date]) dailyStats[date] = { revenue: 0, cost: 0 };
        dailyStats[date].revenue += p.amount_xof;
      });

      completedJobs.forEach((j) => {
        const date = j.created_at.split('T')[0];
        if (!dailyStats[date]) dailyStats[date] = { revenue: 0, cost: 0 };
        dailyStats[date].cost += 50;
      });

      const dailyStatsArray = Object.entries(dailyStats)
        .map(([date, stats]) => ({
          date,
          revenue: stats.revenue,
          cost: stats.cost,
          margin: stats.revenue - stats.cost,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Model stats
      const modelStats: Record<string, { volume: number; totalCost: number; failed: number }> = {};

      jobs?.forEach((j) => {
        const model = j.model_used || 'unknown';
        if (!modelStats[model]) modelStats[model] = { volume: 0, totalCost: 0, failed: 0 };
        modelStats[model].volume++;
        if (j.status === 'completed' || j.status === 'delivered') modelStats[model].totalCost += 50;
        if (j.status === 'failed') modelStats[model].failed++;
      });

      const modelStatsArray = Object.entries(modelStats).map(([model, stats]) => ({
        model,
        volume: stats.volume,
        avgCost: stats.volume > 0 ? Math.round(stats.totalCost / stats.volume) : 0,
        failRate: stats.volume > 0 ? (stats.failed / stats.volume) * 100 : 0,
      }));

      res.json({
        summary: {
          totalRevenue,
          totalCost,
          margin,
          marginPercent,
          marginAlert,
        },
        dailyStats: dailyStatsArray,
        modelStats: modelStatsArray,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
