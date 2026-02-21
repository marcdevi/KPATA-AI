/**
 * Dev Routes for KPATA AI API
 * Development-only endpoints for testing
 * Only enabled when ENABLE_DEV_AUTH=true and NODE_ENV !== 'production'
 */

import { UserRole } from '@kpata/shared';
import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { getCapabilities } from '../lib/plans.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../logger.js';

const router: Router = Router();

const DEV_PHONE = '+225000000000';
const DEV_TERMS_VERSION = 'dev';
const DEV_MIN_CREDITS = 500;

/**
 * Check if dev auth is enabled
 */
function isDevAuthEnabled(): boolean {
  return (
    process.env.ENABLE_DEV_AUTH === 'true' &&
    process.env.NODE_ENV !== 'production'
  );
}

/**
 * POST /dev/login
 * Dev guest login - creates or retrieves dev profile with credits
 */
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!isDevAuthEnabled()) {
      res.status(403).json({
        error: {
          message: 'Dev auth is disabled',
          code: 'DEV_AUTH_DISABLED',
        },
      });
      return;
    }

    const correlationId = req.correlationId;

    logger.info('Dev login request', {
      action: 'dev_login',
      correlation_id: correlationId,
    });

    const supabase = getSupabaseClient();

    // Try to find existing dev profile
    let { data: profile, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone_e164', DEV_PHONE)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    if (!profile) {
      // Create dev profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          phone_e164: DEV_PHONE,
          name: 'Dev Guest',
          role: UserRole.USER_FREE,
          status: 'active',
          terms_accepted_at: new Date().toISOString(),
          terms_version: DEV_TERMS_VERSION,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      profile = newProfile;

      logger.info('Dev profile created', {
        action: 'dev_login_created',
        correlation_id: correlationId,
        user_id: profile.id,
      });
    } else {
      // Update terms if not set
      if (!profile.terms_accepted_at) {
        await supabase
          .from('profiles')
          .update({
            terms_accepted_at: new Date().toISOString(),
            terms_version: DEV_TERMS_VERSION,
          })
          .eq('id', profile.id);

        profile.terms_accepted_at = new Date().toISOString();
        profile.terms_version = DEV_TERMS_VERSION;
      }

      logger.info('Dev profile found', {
        action: 'dev_login_existing',
        correlation_id: correlationId,
        user_id: profile.id,
      });
    }

    // Check credit balance
    const { data: creditData } = await supabase
      .from('credit_ledger')
      .select('amount')
      .eq('profile_id', profile.id);

    const currentBalance = creditData?.reduce((sum, row) => sum + row.amount, 0) || 0;

    // Top up to DEV_MIN_CREDITS if below
    if (currentBalance < DEV_MIN_CREDITS) {
      const topUpAmount = DEV_MIN_CREDITS - currentBalance;

      await supabase.from('credit_ledger').insert({
        profile_id: profile.id,
        entry_type: 'bonus',
        amount: topUpAmount,
        description: 'Dev guest bonus credits',
        idempotency_key: `dev_login_${profile.id}_${Date.now()}`,
        metadata: {
          source: 'dev_login',
          correlation_id: correlationId,
        },
      });

      logger.info('Dev credits topped up', {
        action: 'dev_login_credits',
        correlation_id: correlationId,
        user_id: profile.id,
        meta: { previousBalance: currentBalance, topUpAmount, newBalance: DEV_MIN_CREDITS },
      });
    }

    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET not configured');
    }

    const token = jwt.sign(
      {
        sub: profile.id,
        phone: profile.phone,
        role: profile.role,
      },
      jwtSecret,
      { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as string }
    );

    const capabilities = getCapabilities(profile.role as UserRole);

    res.json({
      token,
      profile: {
        id: profile.id,
        phone: profile.phone_e164,
        role: profile.role,
        displayName: profile.name || 'Dev Guest',
        termsAcceptedAt: profile.terms_accepted_at,
        termsVersion: profile.terms_version,
        createdAt: profile.created_at,
      },
      capabilities,
      credits: Math.max(currentBalance, DEV_MIN_CREDITS),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dev/status
 * Check if dev auth is enabled
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    enabled: isDevAuthEnabled(),
    nodeEnv: process.env.NODE_ENV,
  });
});

export default router;
