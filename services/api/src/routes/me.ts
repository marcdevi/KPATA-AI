/**
 * User Profile Routes for KPATA AI API
 * GET /me - Returns current user profile with capabilities
 */

import { UserRole } from '@kpata/shared';
import { Router, Request, Response, NextFunction } from 'express';

import { UnauthorizedError } from '../lib/errors.js';
import { getCapabilities, getPlanByRole } from '../lib/plans.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../logger.js';

const router: Router = Router();

/**
 * GET /me
 * Returns current user profile with plan capabilities
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    // Block pending_approval and banned users from accessing their profile
    if ((req.user as { status?: string }).status === 'pending_approval') {
      res.status(403).json({
        error: {
          code: 'ACCOUNT_PENDING_APPROVAL',
          message: 'Votre compte est en attente de validation par un administrateur. Vous recevrez un accès dès que votre compte sera approuvé.',
        },
      });
      return;
    }

    const correlationId = req.correlationId;
    const supabase = getSupabaseClient();

    // Get full profile with credit balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (profileError || !profile) {
      throw new UnauthorizedError('Profile not found');
    }

    // Get credit balance
    const { data: balanceData, error: balanceError } = await supabase
      .rpc('get_credit_balance', { p_profile_id: req.user.id });

    const creditBalance = balanceError ? 0 : (balanceData || 0);

    // Get plan and capabilities
    const role = profile.role as UserRole;
    const plan = getPlanByRole(role);
    const capabilities = getCapabilities(role);

    logger.info('Profile fetched', {
      action: 'get_me',
      correlation_id: correlationId,
      user_id: req.user.id,
    });

    res.json({
      profile: {
        id: profile.id,
        phone: profile.phone_e164 || profile.phone || null,
        email: profile.email || null,
        role: profile.role,
        displayName: profile.name || profile.display_name || null,
        avatarUrl: profile.avatar_url || null,
        termsAcceptedAt: profile.terms_accepted_at,
        termsVersion: profile.terms_version,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
      },
      plan: {
        id: plan.id,
        name: plan.name,
      },
      capabilities,
      credits: {
        balance: creditBalance,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
