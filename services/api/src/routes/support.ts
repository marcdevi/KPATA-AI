/**
 * Support Tickets Routes for KPATA AI API
 * User-facing support ticket creation and management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../lib/errors.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { logger } from '../logger.js';

const router: Router = Router();

/**
 * POST /support/tickets
 * Create a new support ticket
 */
const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
});

router.post('/tickets', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { subject, message } = createTicketSchema.parse(req.body);
    const supabase = getSupabaseClient();

    // Create ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .insert({
        profile_id: req.user.id,
        subject,
        status: 'open',
      })
      .select()
      .single();

    if (ticketError) {
      throw ticketError;
    }

    // Create initial message
    const { error: messageError } = await supabase
      .from('ticket_messages')
      .insert({
        ticket_id: ticket.id,
        sender_profile_id: req.user.id,
        content: message,
        is_internal: false,
      });

    if (messageError) {
      throw messageError;
    }

    // Update ticket with last_message_at
    await supabase
      .from('support_tickets')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', ticket.id);

    logger.info('Support ticket created', {
      action: 'ticket_created',
      correlation_id: req.correlationId,
      user_id: req.user.id,
      meta: { ticketId: ticket.id, subject },
    });

    res.status(201).json({
      ticket: {
        id: ticket.id,
        subject: ticket.subject,
        status: ticket.status,
        createdAt: ticket.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support/tickets
 * List user's own tickets
 */
router.get('/tickets', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('id, subject, status, created_at, last_message_at')
      .eq('profile_id', req.user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({ tickets: tickets || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /support/tickets/:id/messages
 * Get messages for a specific ticket
 */
router.get('/tickets/:id/messages', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();

    // Verify ticket belongs to user
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id')
      .eq('id', req.params.id)
      .eq('profile_id', req.user.id)
      .single();

    if (!ticket) {
      res.status(404).json({ error: { message: 'Ticket not found', code: 'NOT_FOUND' } });
      return;
    }

    const { data: messages, error } = await supabase
      .from('ticket_messages')
      .select('*')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ messages: messages || [] });
  } catch (error) {
    next(error);
  }
});

export default router;
