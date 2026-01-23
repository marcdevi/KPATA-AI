/**
 * Content Moderation for KPATA AI
 * Handles violations, sanctions, and user status management
 */

import { ProfileStatus } from '@kpata/shared';

import { logger } from '../logger.js';

import { getSupabaseClient } from './supabase.js';

// Sanction policy: 3 strikes
export const SANCTION_POLICY = {
  WARNING_THRESHOLD: 1,      // 1st violation: warning
  COOLDOWN_THRESHOLD: 2,     // 2nd violation: 24h cooldown
  BAN_THRESHOLD: 3,          // 3rd violation: permanent ban
  COOLDOWN_HOURS: 24,
} as const;

export interface ViolationResult {
  action: 'warning' | 'cooldown' | 'ban';
  violationCount: number;
  cooldownUntil?: Date;
  message: string;
}

export interface UserModerationStatus {
  canCreateJob: boolean;
  reason?: string;
  cooldownUntil?: Date;
  violationCount: number;
  status: ProfileStatus;
}

/**
 * Record a content violation and apply sanctions
 */
export async function recordViolation(
  profileId: string,
  violationType: string,
  details: Record<string, unknown>,
  correlationId?: string
): Promise<ViolationResult> {
  const supabase = getSupabaseClient();

  // Get current violation count
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('violation_count, status')
    .eq('id', profileId)
    .single();

  if (fetchError || !profile) {
    throw new Error('Profile not found');
  }

  const newViolationCount = (profile.violation_count || 0) + 1;
  let action: ViolationResult['action'];
  let newStatus: ProfileStatus = profile.status as ProfileStatus;
  let cooldownUntil: Date | undefined;
  let message: string;

  // Determine sanction based on violation count
  if (newViolationCount >= SANCTION_POLICY.BAN_THRESHOLD) {
    action = 'ban';
    newStatus = ProfileStatus.BANNED;
    message = getBanMessage('fr');
  } else if (newViolationCount >= SANCTION_POLICY.COOLDOWN_THRESHOLD) {
    action = 'cooldown';
    cooldownUntil = new Date(Date.now() + SANCTION_POLICY.COOLDOWN_HOURS * 60 * 60 * 1000);
    message = getCooldownMessage(SANCTION_POLICY.COOLDOWN_HOURS, 'fr');
  } else {
    action = 'warning';
    message = getWarningMessage(newViolationCount, 'fr');
  }

  // Update profile
  const updateData: Record<string, unknown> = {
    violation_count: newViolationCount,
  };

  if (newStatus !== profile.status) {
    updateData.status = newStatus;
    updateData.ban_reason = `Automatic ban: ${newViolationCount} content violations`;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', profileId);

  if (updateError) {
    throw updateError;
  }

  // Log the violation
  logger.warn('Content violation recorded', {
    action: 'content_violation',
    correlation_id: correlationId,
    user_id: profileId,
    meta: {
      violationType,
      violationCount: newViolationCount,
      sanctionAction: action,
      details,
    },
  });

  // Create audit log for bans
  if (action === 'ban') {
    await supabase.from('admin_audit_logs').insert({
      actor_id: null, // System action
      actor_role: 'super_admin',
      action: 'user_banned_auto',
      target_type: 'profile',
      target_id: profileId,
      reason: `Automatic ban: ${newViolationCount} content violations (${violationType})`,
      details: { violationType, violationCount: newViolationCount, ...details },
    });
  }

  return {
    action,
    violationCount: newViolationCount,
    cooldownUntil,
    message,
  };
}

/**
 * Check if a user can create jobs (not banned, not in cooldown)
 */
export async function checkUserModerationStatus(profileId: string): Promise<UserModerationStatus> {
  const supabase = getSupabaseClient();

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('status, violation_count, updated_at')
    .eq('id', profileId)
    .single();

  if (error || !profile) {
    return {
      canCreateJob: false,
      reason: 'Profile not found',
      violationCount: 0,
      status: ProfileStatus.ACTIVE,
    };
  }

  const status = profile.status as ProfileStatus;
  const violationCount = profile.violation_count || 0;

  // Check if banned
  if (status === ProfileStatus.BANNED) {
    return {
      canCreateJob: false,
      reason: getBanMessage('fr'),
      violationCount,
      status,
    };
  }

  // Check if in cooldown (2nd violation within 24h)
  if (violationCount >= SANCTION_POLICY.COOLDOWN_THRESHOLD && violationCount < SANCTION_POLICY.BAN_THRESHOLD) {
    const lastUpdate = new Date(profile.updated_at);
    const cooldownEnd = new Date(lastUpdate.getTime() + SANCTION_POLICY.COOLDOWN_HOURS * 60 * 60 * 1000);
    
    if (Date.now() < cooldownEnd.getTime()) {
      return {
        canCreateJob: false,
        reason: getCooldownMessage(Math.ceil((cooldownEnd.getTime() - Date.now()) / (60 * 60 * 1000)), 'fr'),
        cooldownUntil: cooldownEnd,
        violationCount,
        status,
      };
    }
  }

  // Check if deleting
  if (status === ProfileStatus.DELETING || status === ProfileStatus.DELETED) {
    return {
      canCreateJob: false,
      reason: 'Account is being deleted',
      violationCount,
      status,
    };
  }

  return {
    canCreateJob: true,
    violationCount,
    status,
  };
}

/**
 * Get warning message
 */
function getWarningMessage(violationCount: number, language = 'fr'): string {
  const remaining = SANCTION_POLICY.BAN_THRESHOLD - violationCount;
  
  if (language === 'fr') {
    return `⚠️ Avertissement : Contenu inapproprié détecté. Il vous reste ${remaining} avertissement(s) avant suspension de votre compte.`;
  }
  return `⚠️ Warning: Inappropriate content detected. You have ${remaining} warning(s) remaining before account suspension.`;
}

/**
 * Get cooldown message
 */
function getCooldownMessage(hours: number, language = 'fr'): string {
  if (language === 'fr') {
    return `🚫 Votre compte est temporairement suspendu pour ${hours}h suite à des violations répétées. Dernier avertissement avant bannissement définitif.`;
  }
  return `🚫 Your account is temporarily suspended for ${hours}h due to repeated violations. This is your final warning before permanent ban.`;
}

/**
 * Get ban message
 */
function getBanMessage(language = 'fr'): string {
  if (language === 'fr') {
    return `🚫 Votre compte a été définitivement suspendu pour violations répétées des conditions d'utilisation. Contactez le support si vous pensez qu'il s'agit d'une erreur.`;
  }
  return `🚫 Your account has been permanently suspended for repeated violations of the terms of service. Contact support if you believe this is an error.`;
}
