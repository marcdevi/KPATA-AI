/**
 * Authentication Middleware for KPATA AI API
 * Validates Supabase JWT tokens and populates req.user
 */

import { UserRole } from '@kpata/shared';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../logger.js';

/**
 * Extract Bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
  return parts[1];
}

/**
 * Authentication middleware that validates Supabase tokens
 * and populates req.user with profile data
 */
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    // No token provided - continue without user (routes can check req.user)
    return next();
  }

  try {
    const supabase = getSupabaseClient();
    let userId: string | null = null;
    let userEmail: string | null = null;

    // Try custom JWT first (for dev/login)
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      try {
        const decoded = jwt.verify(token, jwtSecret) as { sub: string };
        userId = decoded.sub;
        logger.debug('Custom JWT verified', {
          action: 'auth_custom_jwt',
          correlation_id: req.correlationId,
          user_id: userId,
        });
      } catch {
        // Not a custom JWT, try Supabase JWT
      }
    }

    // If not custom JWT, try Supabase JWT
    if (!userId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        logger.warn('Invalid auth token', {
          action: 'auth_invalid_token',
          correlation_id: req.correlationId,
          meta: { error: authError?.message },
        });
        // Invalid token - continue without user
        return next();
      }

      userId = user.id;
      userEmail = user.email ?? null;
    }

    // Fetch user profile from database
    // Using limit(1) instead of single() to avoid RLS policy conflicts
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, phone_e164, name, role, status, email')
      .eq('id', userId)
      .limit(1);

    const profile = profiles?.[0] ?? null;

    logger.debug('Profile lookup result', {
      action: 'auth_profile_lookup',
      correlation_id: req.correlationId,
      user_id: userId,
      meta: { 
        found: !!profile, 
        count: profiles?.length ?? 0,
        error: profileError?.message,
        profileId: profile?.id,
      },
    });

    if (profileError || !profile) {
      logger.warn('Profile not found for authenticated user', {
        action: 'auth_profile_not_found',
        correlation_id: req.correlationId,
        user_id: userId,
        meta: { error: profileError?.message },
      });

      // User authenticated but no profile yet (first login) - allow bootstrap routes
      req.user = {
        id: userId,
        role: UserRole.USER_FREE,
        phone: '',
        email: userEmail,
        hasProfile: false,
      };

      return next();
    }

    // Check if user is banned
    if (profile.status === 'banned') {
      logger.warn('Banned user attempted access', {
        action: 'auth_banned_user',
        correlation_id: req.correlationId,
        user_id: profile.id,
      });
      return next();
    }

    // Populate req.user
    req.user = {
      id: profile.id,
      role: profile.role as UserRole,
      phone: profile.phone_e164 || '',
      email: (profile as { email?: string | null }).email ?? userEmail,
      hasProfile: true,
    };

    logger.debug('User authenticated', {
      action: 'auth_success',
      correlation_id: req.correlationId,
      user_id: profile.id,
      meta: { role: profile.role },
    });

    next();
  } catch (error) {
    logger.error('Auth middleware error', {
      action: 'auth_middleware_error',
      correlation_id: req.correlationId,
      meta: { error: String(error) },
    });
    // On error, continue without user rather than blocking
    next();
  }
}
