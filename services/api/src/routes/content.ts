/**
 * Content Moderation Routes for KPATA AI API
 * POST /content/report - Report inappropriate content
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, BadRequestError } from '../lib/errors.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../logger.js';

const router: Router = Router();

/**
 * POST /content/report
 * Report inappropriate content
 */
const reportSchema = z.object({
  jobId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  profileId: z.string().uuid().optional(),
  reason: z.enum(['nsfw', 'violence', 'hate_speech', 'spam', 'copyright', 'other']),
  description: z.string().max(1000).optional(),
}).refine(
  (data) => data.jobId || data.assetId || data.profileId,
  { message: 'At least one of jobId, assetId, or profileId must be provided' }
);

router.post('/report', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const input = reportSchema.parse(req.body);
    const correlationId = req.correlationId;
    const reporterId = req.user.id;

    const supabase = getSupabaseClient();

    // Verify targets exist
    if (input.jobId) {
      const { data: job } = await supabase
        .from('jobs')
        .select('id')
        .eq('id', input.jobId)
        .single();
      
      if (!job) {
        throw new BadRequestError('Job not found');
      }
    }

    if (input.assetId) {
      const { data: asset } = await supabase
        .from('assets')
        .select('id')
        .eq('id', input.assetId)
        .single();
      
      if (!asset) {
        throw new BadRequestError('Asset not found');
      }
    }

    if (input.profileId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', input.profileId)
        .single();
      
      if (!profile) {
        throw new BadRequestError('Profile not found');
      }
    }

    // Create report
    const { data: report, error } = await supabase
      .from('content_reports')
      .insert({
        reporter_id: reporterId,
        reported_job_id: input.jobId || null,
        reported_asset_id: input.assetId || null,
        reported_profile_id: input.profileId || null,
        reason: input.reason,
        description: input.description || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Content report created', {
      action: 'content_report_created',
      correlation_id: correlationId,
      user_id: reporterId,
      meta: {
        reportId: report.id,
        reason: input.reason,
        targetJob: input.jobId,
        targetAsset: input.assetId,
        targetProfile: input.profileId,
      },
    });

    res.status(201).json({
      report: {
        id: report.id,
        reason: report.reason,
        status: report.status,
        createdAt: report.created_at,
      },
      message: 'Thank you for your report. Our team will review it shortly.',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /content/reports
 * List user's own reports
 */
router.get('/reports', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();

    const { data: reports, error } = await supabase
      .from('content_reports')
      .select('id, reason, status, created_at, reviewed_at')
      .eq('reporter_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({ reports: reports || [] });
  } catch (error) {
    next(error);
  }
});

export default router;
