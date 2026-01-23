/**
 * Terms & Conditions Routes for KPATA AI API
 * POST /terms/accept - Accept terms and conditions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, BadRequestError } from '../lib/errors.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { validateBody } from '../lib/validation.js';
import { logger } from '../logger.js';

const router: Router = Router();

const CURRENT_TERMS_VERSION = '1.0.0';

/**
 * GET /terms/current
 * Get current terms version
 */
router.get('/current', (_req: Request, res: Response) => {
  return res.json({
    version: CURRENT_TERMS_VERSION,
    effectiveDate: '2026-01-01',
    url: 'https://kpata.ai/terms',
  });
});

/**
 * POST /terms/accept
 * Accept terms and conditions
 */
const acceptTermsSchema = z.object({
  version: z.string().min(1),
});

router.post('/accept', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { version } = validateBody(acceptTermsSchema, req.body);
    const correlationId = req.correlationId;

    // Validate version matches current
    if (version !== CURRENT_TERMS_VERSION) {
      throw new BadRequestError(`Invalid terms version. Current version is ${CURRENT_TERMS_VERSION}`);
    }

    const supabase = getSupabaseClient();

    // Update profile with terms acceptance
    const { data: profile, error } = await supabase
      .from('profiles')
      .update({
        terms_accepted_at: new Date().toISOString(),
        terms_version: version,
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    logger.info('Terms accepted', {
      action: 'terms_accepted',
      correlation_id: correlationId,
      user_id: req.user.id,
      meta: { version },
    });

    res.json({
      success: true,
      termsAcceptedAt: profile.terms_accepted_at,
      termsVersion: profile.terms_version,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /terms/status
 * Check if user has accepted current terms
 */
router.get('/status', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('terms_accepted_at, terms_version')
      .eq('id', req.user.id)
      .single();

    if (error) {
      throw error;
    }

    const isAccepted = profile.terms_version === CURRENT_TERMS_VERSION && profile.terms_accepted_at !== null;

    res.json({
      accepted: isAccepted,
      currentVersion: CURRENT_TERMS_VERSION,
      userVersion: profile.terms_version,
      acceptedAt: profile.terms_accepted_at,
    });
  } catch (error) {
    next(error);
  }
});

export { CURRENT_TERMS_VERSION };
export default router;
