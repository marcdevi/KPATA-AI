/**
 * Admin Tickets Routes for KPATA AI API
 * Support ticket management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, NotFoundError } from '../../lib/errors.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { logger } from '../../logger.js';
import { requirePermission, PERMISSIONS } from '../../middleware/rbac.js';

const router: Router = Router();

/**
 * GET /admin/tickets
 * List support tickets
 */
const listTicketsSchema = z.object({
  status: z.enum(['open', 'in_progress', 'closed']).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

router.get(
  '/',
  requirePermission(PERMISSIONS.TICKETS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { status, limit, offset } = listTicketsSchema.parse(req.query);
      const supabase = getSupabaseClient();

      let query = supabase
        .from('support_tickets')
        .select('*, profile:profiles!profile_id(phone_e164)', { count: 'exact' })
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      res.json({
        tickets: data || [],
        pagination: { total: count || 0 },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /admin/tickets/:id/messages
 * Get ticket messages
 */
router.get(
  '/:id/messages',
  requirePermission(PERMISSIONS.TICKETS_VIEW),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*')
        .eq('ticket_id', req.params.id)
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      res.json({ messages: data || [] });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/tickets/:id/reply
 * Reply to a ticket
 */
const replySchema = z.object({
  content: z.string().min(1).max(2000),
});

router.post(
  '/:id/reply',
  requirePermission(PERMISSIONS.TICKETS_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const { content } = replySchema.parse(req.body);
      const ticketId = req.params.id;
      const supabase = getSupabaseClient();

      // Verify ticket exists
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('id, profile_id')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        throw new NotFoundError('Ticket not found');
      }

      // Insert message
      const { data: message, error: messageError } = await supabase
        .from('ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_type: 'agent',
          sender_id: req.user.id,
          content,
        })
        .select()
        .single();

      if (messageError) {
        throw messageError;
      }

      // Update ticket
      await supabase
        .from('support_tickets')
        .update({
          status: 'in_progress',
          last_message_at: new Date().toISOString(),
          assigned_to: req.user.id,
        })
        .eq('id', ticketId);

      logger.info('Ticket reply sent', {
        action: 'ticket_reply',
        correlation_id: req.correlationId,
        user_id: req.user.id,
        meta: { ticketId },
      });

      res.json({ message });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /admin/tickets/:id/close
 * Close a ticket
 */
router.post(
  '/:id/close',
  requirePermission(PERMISSIONS.TICKETS_MANAGE),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const ticketId = req.params.id;
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('support_tickets')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          closed_by: req.user.id,
        })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log audit
      await supabase.from('admin_audit_logs').insert({
        actor_id: req.user.id,
        actor_role: req.user.role,
        action: 'ticket_close',
        target_type: 'ticket',
        target_id: ticketId,
        ip_address: req.ip || null,
        user_agent: req.headers['user-agent'] || null,
      });

      res.json({ ticket: data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
