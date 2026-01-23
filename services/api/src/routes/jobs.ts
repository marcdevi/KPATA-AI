/**
 * Jobs Routes for KPATA AI API
 * POST /jobs - Create job with idempotency and credit debit
 */

import { SourceChannel, BackgroundStyle, JobCategory, MannequinMode, TemplateLayout, UserRole } from '@kpata/shared';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, InsufficientCreditsError, ConflictError, ForbiddenError, BadRequestError } from '../lib/errors.js';
import { generateIdempotencyKey } from '../lib/idempotency.js';
import { checkUserModerationStatus, recordViolation } from '../lib/moderation.js';
import { checkNSFWBase64, getNSFWWarningMessage } from '../lib/nsfw.js';
import { publishJob } from '../lib/queue.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { validateBody } from '../lib/validation.js';
import { logger } from '../logger.js';
import { jobRateLimitMiddleware } from '../middleware/rateLimit.js';

const router: Router = Router();

/**
 * POST /jobs
 * Create a new job with idempotency and credit debit
 */
const createJobSchema = z.object({
  sourceChannel: z.nativeEnum(SourceChannel).optional().default(SourceChannel.MOBILE_APP),
  sourceMessageId: z.string().optional(),
  clientRequestId: z.string().optional(),
  category: z.nativeEnum(JobCategory).optional().default(JobCategory.CLOTHING),
  backgroundStyle: z.nativeEnum(BackgroundStyle).optional().default(BackgroundStyle.STUDIO_WHITE),
  templateLayout: z.nativeEnum(TemplateLayout).optional().default(TemplateLayout.SQUARE_1X1),
  mannequinMode: z.nativeEnum(MannequinMode).optional().default(MannequinMode.NONE),
  imageBase64: z.string().optional(), // For NSFW pre-check
});

router.post(
  '/',
  jobRateLimitMiddleware(2), // Max 2 concurrent jobs
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = validateBody(createJobSchema, req.body);
      const correlationId = req.correlationId;
      const userId = req.user.id;

      // Check if user is banned or in cooldown
      const moderationStatus = await checkUserModerationStatus(userId);
      if (!moderationStatus.canCreateJob) {
        throw new ForbiddenError(moderationStatus.reason || 'You cannot create jobs at this time');
      }

      // NSFW pre-check if image provided
      if (input.imageBase64) {
        try {
          const nsfwResult = await checkNSFWBase64(input.imageBase64);
          
          if (nsfwResult.isNSFW) {
            // Record violation and apply sanctions
            const violation = await recordViolation(
              userId,
              'NSFW_CONTENT',
              {
                category: nsfwResult.violatingCategory,
                score: nsfwResult.violatingScore,
              },
              correlationId
            );

            logger.warn('NSFW content rejected', {
              action: 'nsfw_rejected',
              correlation_id: correlationId,
              user_id: userId,
              meta: {
                category: nsfwResult.violatingCategory,
                score: nsfwResult.violatingScore,
                sanctionAction: violation.action,
                violationCount: violation.violationCount,
              },
            });

            // Return rejection without debiting credits
            throw new BadRequestError(
              getNSFWWarningMessage(nsfwResult, 'fr'),
              {
                code: 'NSFW_DETECTED',
                violationCount: violation.violationCount,
                sanctionAction: violation.action,
              }
            );
          }
        } catch (error) {
          // If it's our BadRequestError, rethrow it
          if (error instanceof BadRequestError) {
            throw error;
          }
          // Log NSFW check errors but don't block job creation
          logger.error('NSFW check failed', {
            action: 'nsfw_check_error',
            correlation_id: correlationId,
            user_id: userId,
            meta: { error: String(error) },
          });
        }
      }

      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey(
        input.sourceChannel,
        input.sourceMessageId,
        input.clientRequestId
      );

      logger.info('Creating job', {
        action: 'job_create_start',
        correlation_id: correlationId,
        user_id: userId,
        meta: { idempotencyKey, sourceChannel: input.sourceChannel },
      });

      const supabase = getSupabaseClient();

      // Call create_job_and_debit RPC
      const { data, error } = await supabase.rpc('create_job_and_debit', {
        p_profile_id: userId,
        p_idempotency_key: idempotencyKey,
        p_category: input.category,
        p_background_style: input.backgroundStyle,
        p_template_layout: input.templateLayout,
        p_mannequin_mode: input.mannequinMode,
        p_source_channel: input.sourceChannel,
        p_source_message_id: input.sourceMessageId || null,
        p_client_request_id: input.clientRequestId || null,
      });

      if (error) {
        logger.error('Job creation RPC error', {
          action: 'job_create_rpc_error',
          correlation_id: correlationId,
          user_id: userId,
          meta: { error: error.message },
        });
        throw error;
      }

      const result = data?.[0];

      if (!result) {
        throw new Error('Unexpected empty result from create_job_and_debit');
      }

      // Check for errors
      if (result.error_code === 'INSUFFICIENT_CREDITS') {
        throw new InsufficientCreditsError(1, result.balance_after);
      }

      // Check if job was already created (idempotent)
      if (!result.was_created) {
        logger.info('Job already exists (idempotent)', {
          action: 'job_create_idempotent',
          correlation_id: correlationId,
          user_id: userId,
          meta: { jobId: result.job_id, idempotencyKey },
        });

        // Fetch existing job details
        const { data: existingJob } = await supabase
          .from('jobs')
          .select('*')
          .eq('id', result.job_id)
          .single();

        res.status(200).json({
          job: existingJob,
          wasCreated: false,
          creditsRemaining: result.balance_after,
        });
        return;
      }

      // Fetch created job
      const { data: newJob } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', result.job_id)
        .single();

      logger.info('Job created successfully', {
        action: 'job_create_success',
        correlation_id: correlationId,
        user_id: userId,
        meta: { jobId: result.job_id, creditsRemaining: result.balance_after },
      });

      // Determine priority based on user role
      const priority = req.user.role === UserRole.USER_PRO || req.user.role === UserRole.RESELLER
        ? 'high'
        : 'low';

      // Publish to queue for processing
      await publishJob({
        jobId: result.job_id,
        profileId: userId,
        correlationId: correlationId || '',
        priority,
        category: input.category,
        backgroundStyle: input.backgroundStyle,
        templateLayout: input.templateLayout,
        mannequinMode: input.mannequinMode,
        sourceChannel: input.sourceChannel,
      });

      logger.info('Job published to queue', {
        action: 'job_queue_published',
        correlation_id: correlationId,
        user_id: userId,
        meta: { jobId: result.job_id, priority },
      });

      res.status(201).json({
        job: newJob,
        wasCreated: true,
        creditsRemaining: result.balance_after,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /jobs
 * List user's jobs with pagination
 */
const listJobsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
  status: z.string().optional(),
});

router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { limit, offset, status } = listJobsSchema.parse(req.query);
    const supabase = getSupabaseClient();

    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('profile_id', req.user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, count, error } = await query;

    if (error) {
      throw error;
    }

    res.json({
      jobs: jobs || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /jobs/:id
 * Get single job details
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', req.params.id)
      .eq('profile_id', req.user.id)
      .single();

    if (error || !job) {
      throw new ConflictError('Job not found');
    }

    res.json({ job });
  } catch (error) {
    next(error);
  }
});

export default router;
