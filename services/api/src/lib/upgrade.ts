/**
 * Auto Upgrade Logic for KPATA AI
 * Upgrades user to pro on first successful topup
 */

import { UserRole } from '@kpata/shared';

import { logger } from '../logger.js';

import { getSupabaseClient } from './supabase.js';

/**
 * Upgrade user to pro after successful payment
 * Called when a topup payment succeeds
 */
export async function upgradeToProOnTopup(
  userId: string,
  correlationId?: string
): Promise<{ upgraded: boolean; previousRole: UserRole; newRole: UserRole }> {
  const supabase = getSupabaseClient();

  // Get current profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (fetchError || !profile) {
    logger.error('Failed to fetch profile for upgrade', {
      action: 'upgrade_fetch_error',
      correlation_id: correlationId,
      user_id: userId,
      meta: { error: String(fetchError) },
    });
    throw fetchError || new Error('Profile not found');
  }

  const previousRole = profile.role as UserRole;

  // Only upgrade if currently free
  if (previousRole !== UserRole.USER_FREE) {
    logger.info('User already upgraded, skipping', {
      action: 'upgrade_skipped',
      correlation_id: correlationId,
      user_id: userId,
      meta: { currentRole: previousRole },
    });
    return { upgraded: false, previousRole, newRole: previousRole };
  }

  // Upgrade to pro
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: UserRole.USER_PRO })
    .eq('id', userId);

  if (updateError) {
    logger.error('Failed to upgrade user to pro', {
      action: 'upgrade_error',
      correlation_id: correlationId,
      user_id: userId,
      meta: { error: String(updateError) },
    });
    throw updateError;
  }

  logger.info('User upgraded to pro', {
    action: 'upgrade_success',
    correlation_id: correlationId,
    user_id: userId,
    meta: { previousRole, newRole: UserRole.USER_PRO },
  });

  return { upgraded: true, previousRole, newRole: UserRole.USER_PRO };
}

/**
 * Process successful payment and upgrade user if needed
 * This is called after payment confirmation
 */
export async function processPaymentSuccess(
  userId: string,
  paymentId: string,
  amount: number,
  correlationId?: string
): Promise<void> {
  logger.info('Processing payment success', {
    action: 'payment_success_processing',
    correlation_id: correlationId,
    user_id: userId,
    meta: { paymentId, amount },
  });

  // Upgrade to pro (lifetime after first purchase)
  await upgradeToProOnTopup(userId, correlationId);
}
