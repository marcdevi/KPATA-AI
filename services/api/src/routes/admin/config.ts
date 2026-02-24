/**
 * Admin Config Routes for KPATA AI API
 * Model routing and prompt profiles management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../logger.js';
import { requirePermission, requireRole, PERMISSIONS } from '../../middleware/rbac.js';
import { UserRole } from '@kpata/shared';

const router: Router = Router();

/**
 * GET /admin/config
 * Get all config (model routing + prompt profiles)
 */
router.get(
  '/',
  requirePermission(PERMISSIONS.CONFIG_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      const [{ data: modelRouting }, { data: promptProfiles }] = await Promise.all([
        supabase.from('model_routing').select('*').order('category'),
        supabase.from('prompt_profiles').select('*').order('style'),
      ]);

      res.json({
        modelRouting: modelRouting || [],
        promptProfiles: promptProfiles || [],
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/config/model-routing/:id
 * Update model routing config (super_admin only)
 */
const updateRoutingSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  fallback_provider: z.string().optional(),
  fallback_model: z.string().optional(),
  active: z.boolean().optional(),
});

router.patch(
  '/model-routing/:id',
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updates = updateRoutingSchema.parse(req.body);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('model_routing')
        .update(updates)
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'config_update',
        target_type: 'model_routing',
        target_id: req.params.id,
        changes_json: updates,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('Model routing updated', {
        action: 'model_routing_updated',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { routingId: req.params.id, updates },
      });

      res.json({ routing: data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/config/prompt-profiles/:id
 * Update prompt profile (super_admin only)
 */
const updatePromptSchema = z.object({
  prompt: z.string().optional(),
  negative_prompt: z.string().optional(),
  params_json: z.record(z.string(), z.unknown()).optional(),
  active: z.boolean().optional(),
});

router.patch(
  '/prompt-profiles/:id',
  requireRole(UserRole.SUPER_ADMIN),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updates = updatePromptSchema.parse(req.body);
      const supabase = getSupabaseClient();

      // Get current version
      const { data: current } = await supabase
        .from('prompt_profiles')
        .select('version')
        .eq('id', req.params.id)
        .single();

      const { data, error } = await supabase
        .from('prompt_profiles')
        .update({
          ...updates,
          version: (current?.version || 0) + 1,
        })
        .eq('id', req.params.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'config_update',
        target_type: 'prompt_profile',
        target_id: req.params.id,
        changes_json: updates,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('Prompt profile updated', {
        action: 'prompt_profile_updated',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { profileId: req.params.id },
      });

      res.json({ profile: data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
