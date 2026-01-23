/**
 * Admin Credit Management Routes for KPATA AI API
 * POST /admin/credits/refund - Admin refund with cap
 */

import { UserRole } from '@kpata/shared';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { validateBody } from '../../lib/validation.js';
import { logger } from '../../logger.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

// Admin refund cap: 5000 XOF equivalent in credits
// Assuming 1 credit = 300 XOF (based on PACK_5: 5 credits = 1500 XOF)
const CREDIT_VALUE_XOF = 300;
const ADMIN_REFUND_CAP_XOF = 5000;
const ADMIN_REFUND_CAP_CREDITS = Math.floor(ADMIN_REFUND_CAP_XOF / CREDIT_VALUE_XOF); // ~16 credits

/**
 * POST /admin/credits/refund
 * Admin credit refund with cap (super_admin unlimited)
 */
const refundSchema = z.object({
  profileId: z.string().uuid(),
  credits: z.number().int().positive(),
  reason: z.string().min(10).max(500),
});

router.post(
  '/refund',
  requirePermission(PERMISSIONS.CREDITS_REFUND),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const input = validateBody(refundSchema, req.body);
      const correlationId = req.correlationId;
      const actorId = req.user.id;
      const actorRole = req.user.role;

      // Check refund cap for non-super_admin
      if (actorRole !== UserRole.SUPER_ADMIN && input.credits > ADMIN_REFUND_CAP_CREDITS) {
        throw new ForbiddenError(
          `Refund amount exceeds cap. Maximum ${ADMIN_REFUND_CAP_CREDITS} credits (${ADMIN_REFUND_CAP_XOF} XOF) for admin role.`
        );
      }

      const supabase = getSupabaseClient();

      // Verify target profile exists
      const { data: targetProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, phone, role')
        .eq('id', input.profileId)
        .single();

      if (profileError || !targetProfile) {
        throw new NotFoundError('Target profile not found');
      }

      // Create idempotency key for this refund
      const idempotencyKey = `admin_refund_${actorId}_${input.profileId}_${Date.now()}`;

      // Insert credit ledger entry
      const { data: ledgerEntry, error: ledgerError } = await supabase
        .from('credit_ledger')
        .insert({
          profile_id: input.profileId,
          entry_type: 'admin_adjustment',
          amount: input.credits,
          idempotency_key: idempotencyKey,
          description: `Admin refund: ${input.reason}`,
          metadata: {
            actor_id: actorId,
            actor_role: actorRole,
            reason: input.reason,
          },
        })
        .select()
        .single();

      if (ledgerError) {
        throw ledgerError;
      }

      // Create audit log entry (mandatory)
      const { error: auditError } = await supabase
        .from('admin_audit_logs')
        .insert({
          actor_id: actorId,
          actor_role: actorRole,
          action: 'credit_refund',
          target_type: 'profile',
          target_id: input.profileId,
          reason: input.reason,
          details: {
            credits: input.credits,
            credits_xof_value: input.credits * CREDIT_VALUE_XOF,
            ledger_entry_id: ledgerEntry.id,
          },
          ip_address: req.ip || null,
          user_agent: req.headers['user-agent'] || null,
        });

      if (auditError) {
        logger.error('Failed to create audit log', {
          action: 'admin_refund_audit_error',
          correlation_id: correlationId,
          user_id: actorId,
          meta: { error: auditError.message },
        });
        // Don't fail the request, but log the error
      }

      // Get new balance
      const { data: balanceData } = await supabase
        .rpc('get_credit_balance', { p_profile_id: input.profileId });

      const newBalance = balanceData || 0;

      logger.info('Admin credit refund completed', {
        action: 'admin_credit_refund',
        correlation_id: correlationId,
        user_id: actorId,
        meta: {
          targetProfileId: input.profileId,
          credits: input.credits,
          reason: input.reason,
          newBalance,
        },
      });

      res.json({
        success: true,
        ledgerEntryId: ledgerEntry.id,
        creditsAdded: input.credits,
        newBalance,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/credits/balance/:profileId
 * Get user's credit balance (admin view)
 */
router.get(
  '/balance/:profileId',
  requirePermission(PERMISSIONS.CREDITS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const profileId = req.params.profileId;
      const supabase = getSupabaseClient();

      // Verify profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, phone, role, status')
        .eq('id', profileId)
        .single();

      if (profileError || !profile) {
        throw new NotFoundError('Profile not found');
      }

      // Get balance
      const { data: balance } = await supabase
        .rpc('get_credit_balance', { p_profile_id: profileId });

      // Get recent ledger entries
      const { data: recentEntries } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(10);

      res.json({
        profile: {
          id: profile.id,
          phone: profile.phone,
          role: profile.role,
          status: profile.status,
        },
        credits: {
          balance: balance || 0,
        },
        recentTransactions: recentEntries || [],
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
