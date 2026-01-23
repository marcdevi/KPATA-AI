/**
 * Auth Routes for KPATA AI API
 * Phone-based authentication (one account per phone number)
 */

import { UserRole } from '@kpata/shared';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { normalizePhone } from '../lib/phone.js';
import { getCapabilities } from '../lib/plans.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { validateBody } from '../lib/validation.js';
import { logger } from '../logger.js';

const router: Router = Router();

/**
 * POST /auth/phone/link
 * Link a phone number to a profile (get or create)
 * Used by bot and app to authenticate users
 */
const phoneLinkSchema = z.object({
  phone: z.string().min(1),
  source: z.enum(['telegram', 'whatsapp', 'app']).optional().default('app'),
  telegramId: z.string().optional(),
  displayName: z.string().optional(),
});

router.post('/phone/link', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { phone, source, telegramId, displayName } = validateBody(phoneLinkSchema, req.body);
    const correlationId = req.correlationId;

    // Normalize phone to E.164
    const normalizedPhone = normalizePhone(phone);

    logger.info('Phone link request', {
      action: 'auth_phone_link',
      correlation_id: correlationId,
      meta: { phone: normalizedPhone, source },
    });

    const supabase = getSupabaseClient();

    // Try to find existing profile by phone
    const { data: existingProfile, error: findError } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalizedPhone)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      // PGRST116 = no rows returned
      throw findError;
    }

    if (existingProfile) {
      // Update telegram_id if provided and different
      if (telegramId && existingProfile.telegram_id !== telegramId) {
        await supabase
          .from('profiles')
          .update({ telegram_id: telegramId })
          .eq('id', existingProfile.id);
      }

      logger.info('Existing profile found', {
        action: 'auth_phone_link_existing',
        correlation_id: correlationId,
        user_id: existingProfile.id,
        meta: { phone: normalizedPhone },
      });

      const capabilities = getCapabilities(existingProfile.role as UserRole);

      res.json({
        profile: {
          id: existingProfile.id,
          phone: existingProfile.phone,
          role: existingProfile.role,
          displayName: existingProfile.display_name,
          termsAcceptedAt: existingProfile.terms_accepted_at,
          termsVersion: existingProfile.terms_version,
          createdAt: existingProfile.created_at,
        },
        capabilities,
        isNew: false,
      });
      return;
    }

    // Create new profile
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        phone: normalizedPhone,
        telegram_id: telegramId || null,
        display_name: displayName || null,
        role: UserRole.USER_FREE,
        status: 'active',
        source_channel: source,
      })
      .select()
      .single();

    if (createError) {
      // Handle unique constraint violation (race condition)
      if (createError.code === '23505') {
        // Retry fetch
        const { data: retryProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', normalizedPhone)
          .single();

        if (retryProfile) {
          const capabilities = getCapabilities(retryProfile.role as UserRole);
          res.json({
            profile: {
              id: retryProfile.id,
              phone: retryProfile.phone,
              role: retryProfile.role,
              displayName: retryProfile.display_name,
              termsAcceptedAt: retryProfile.terms_accepted_at,
              termsVersion: retryProfile.terms_version,
              createdAt: retryProfile.created_at,
            },
            capabilities,
            isNew: false,
          });
          return;
        }
      }
      throw createError;
    }

    logger.info('New profile created', {
      action: 'auth_phone_link_created',
      correlation_id: correlationId,
      user_id: newProfile.id,
      meta: { phone: normalizedPhone, source },
    });

    const capabilities = getCapabilities(UserRole.USER_FREE);

    res.status(201).json({
      profile: {
        id: newProfile.id,
        phone: newProfile.phone,
        role: newProfile.role,
        displayName: newProfile.display_name,
        termsAcceptedAt: newProfile.terms_accepted_at,
        termsVersion: newProfile.terms_version,
        createdAt: newProfile.created_at,
      },
      capabilities,
      isNew: true,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
