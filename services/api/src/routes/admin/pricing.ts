/**
 * Admin Pricing Routes for KPATA AI API
 * Credit packs and pricing config management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../logger.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/pricing
 * Get pricing config and credit packs
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

      const [{ data: packs }, { data: config }] = await Promise.all([
        supabase.from('credit_packs').select('*').order('price_xof'),
        supabase.from('app_config').select('*').eq('key', 'pricing').single(),
      ]);

      res.json({
        packs: packs || [],
        config: config?.value || {
          credits_per_job: 1,
          margin_alert_threshold: 20,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/pricing/packs/:id
 * Update a credit pack
 */
const updatePackSchema = z.object({
  credits: z.number().min(1).optional(),
  price_xof: z.number().min(100).optional(),
  active: z.boolean().optional(),
});

router.patch(
  '/packs/:id',
  requirePermission(PERMISSIONS.CONFIG_EDIT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updates = updatePackSchema.parse(req.body);
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('credit_packs')
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
        action: 'pricing_update',
        target_type: 'credit_pack',
        target_id: req.params.id,
        changes_json: updates,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('Credit pack updated', {
        action: 'credit_pack_updated',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { packId: req.params.id, updates },
      });

      res.json({ pack: data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /admin/pricing/config
 * Update pricing config
 */
const updateConfigSchema = z.object({
  credits_per_job: z.number().min(1).optional(),
  margin_alert_threshold: z.number().min(0).max(100).optional(),
});

router.patch(
  '/config',
  requirePermission(PERMISSIONS.CONFIG_EDIT),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const updates = updateConfigSchema.parse(req.body);
      const supabase = getSupabaseClient();

      // Upsert config
      const { data, error } = await supabase
        .from('app_config')
        .upsert({
          key: 'pricing',
          value: updates,
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'pricing_config_update',
        target_type: 'app_config',
        target_id: 'pricing',
        changes_json: updates,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      logger.info('Pricing config updated', {
        action: 'pricing_config_updated',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { updates },
      });

      res.json({ config: data?.value });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
