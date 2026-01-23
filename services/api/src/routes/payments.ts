/**
 * Payment Routes for KPATA AI API
 * POST /payments/init - Initialize payment
 * POST /payments/webhook/:provider - Handle payment webhooks
 */

import { PaymentProvider, PaymentStatus } from '@kpata/shared';
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';

import { UnauthorizedError, BadRequestError, NotFoundError } from '../lib/errors.js';
import { normalizePhone } from '../lib/phone.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { upgradeToProOnTopup } from '../lib/upgrade.js';
import { validateBody } from '../lib/validation.js';
import { logger } from '../logger.js';

const router: Router = Router();

/**
 * GET /payments/packs
 * List available credit packs
 */
router.get('/packs', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const supabase = getSupabaseClient();

    const { data: packs, error } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) {
      throw error;
    }

    res.json({ packs: packs || [] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/init
 * Initialize a payment for a credit pack
 */
const initPaymentSchema = z.object({
  packCode: z.string().min(1),
  provider: z.nativeEnum(PaymentProvider),
  phoneE164: z.string().optional(),
});

router.post('/init', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const input = validateBody(initPaymentSchema, req.body);
    const correlationId = req.correlationId;
    const userId = req.user.id;

    // Normalize phone if provided
    const phoneE164 = input.phoneE164 ? normalizePhone(input.phoneE164) : req.user.phone;

    const supabase = getSupabaseClient();

    // Verify pack exists and is active
    const { data: pack, error: packError } = await supabase
      .from('credit_packs')
      .select('*')
      .eq('code', input.packCode)
      .eq('active', true)
      .single();

    if (packError || !pack) {
      throw new BadRequestError('Invalid or inactive pack code');
    }

    // Generate provider reference (would be from actual provider in production)
    const providerRef = `${input.provider}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Create pending payment
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        profile_id: userId,
        provider: input.provider,
        provider_ref: providerRef,
        pack_code: input.packCode,
        amount_xof: pack.price_xof,
        credits_granted: pack.credits,
        status: PaymentStatus.PENDING,
        phone_e164: phoneE164,
      })
      .select()
      .single();

    if (paymentError) {
      throw paymentError;
    }

    logger.info('Payment initialized', {
      action: 'payment_init',
      correlation_id: correlationId,
      user_id: userId,
      meta: {
        paymentId: payment.id,
        packCode: input.packCode,
        provider: input.provider,
        amountXof: pack.price_xof,
      },
    });

    // In production, this would return payment URL from provider
    res.status(201).json({
      payment: {
        id: payment.id,
        providerRef,
        provider: input.provider,
        packCode: input.packCode,
        amountXof: pack.price_xof,
        credits: pack.credits,
        status: payment.status,
      },
      // paymentUrl: 'https://provider.com/pay/...' // Would come from provider
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /payments/webhook/:provider
 * Handle payment provider webhooks (idempotent)
 */
const webhookSchema = z.object({
  providerRef: z.string().min(1),
  status: z.enum(['succeeded', 'failed', 'canceled']),
  rawEvent: z.record(z.string(), z.unknown()).optional(),
});

router.post('/webhook/:provider', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const provider = req.params.provider as PaymentProvider;
    const correlationId = req.correlationId;

    // Validate provider
    if (!Object.values(PaymentProvider).includes(provider)) {
      throw new BadRequestError(`Invalid provider: ${provider}`);
    }

    const input = validateBody(webhookSchema, req.body);
    const supabase = getSupabaseClient();

    logger.info('Payment webhook received', {
      action: 'payment_webhook_received',
      correlation_id: correlationId,
      meta: { provider, providerRef: input.providerRef, status: input.status },
    });

    // Find existing payment
    const { data: existingPayment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('provider', provider)
      .eq('provider_ref', input.providerRef)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      throw findError;
    }

    if (!existingPayment) {
      throw new NotFoundError(`Payment not found: ${input.providerRef}`, { providerRef: input.providerRef });
    }

    // Check if already processed (idempotent)
    if (existingPayment.status === PaymentStatus.SUCCEEDED) {
      logger.info('Payment already processed (idempotent)', {
        action: 'payment_webhook_idempotent',
        correlation_id: correlationId,
        meta: { paymentId: existingPayment.id, providerRef: input.providerRef },
      });

      res.json({
        success: true,
        message: 'Payment already processed',
        paymentId: existingPayment.id,
      });
      return;
    }

    // Handle based on status
    if (input.status === 'succeeded') {
      // Check if topup already exists in ledger (double-check idempotency)
      const { data: existingLedger } = await supabase
        .from('credit_ledger')
        .select('id')
        .eq('payment_id', existingPayment.id)
        .eq('entry_type', 'topup')
        .single();

      if (existingLedger) {
        logger.info('Topup ledger entry already exists (idempotent)', {
          action: 'payment_webhook_ledger_exists',
          correlation_id: correlationId,
          meta: { paymentId: existingPayment.id },
        });

        res.json({
          success: true,
          message: 'Payment already processed',
          paymentId: existingPayment.id,
        });
        return;
      }

      // Update payment status
      await supabase
        .from('payments')
        .update({
          status: PaymentStatus.SUCCEEDED,
          raw_event: input.rawEvent,
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id);

      // Add credits to ledger
      const idempotencyKey = `topup_${provider}_${input.providerRef}`;
      
      const { error: ledgerError } = await supabase
        .from('credit_ledger')
        .insert({
          profile_id: existingPayment.profile_id,
          entry_type: 'topup',
          amount: existingPayment.credits_granted,
          payment_id: existingPayment.id,
          idempotency_key: idempotencyKey,
          description: `Credit pack purchase: ${existingPayment.pack_code}`,
        });

      if (ledgerError) {
        // Check if it's a duplicate (idempotent)
        if (ledgerError.code === '23505') {
          logger.info('Ledger entry already exists (concurrent)', {
            action: 'payment_webhook_ledger_concurrent',
            correlation_id: correlationId,
            meta: { paymentId: existingPayment.id },
          });
        } else {
          throw ledgerError;
        }
      }

      // Upgrade user to pro on first successful topup
      try {
        await upgradeToProOnTopup(existingPayment.profile_id, correlationId);
      } catch (upgradeError) {
        // Log but don't fail the webhook
        logger.error('Failed to upgrade user to pro', {
          action: 'payment_webhook_upgrade_error',
          correlation_id: correlationId,
          user_id: existingPayment.profile_id,
          meta: { error: String(upgradeError) },
        });
      }

      logger.info('Payment succeeded and credits added', {
        action: 'payment_webhook_success',
        correlation_id: correlationId,
        user_id: existingPayment.profile_id,
        meta: {
          paymentId: existingPayment.id,
          creditsAdded: existingPayment.credits_granted,
        },
      });

      res.json({
        success: true,
        message: 'Payment processed successfully',
        paymentId: existingPayment.id,
        creditsAdded: existingPayment.credits_granted,
      });
    } else {
      // Failed or canceled
      await supabase
        .from('payments')
        .update({
          status: input.status === 'failed' ? PaymentStatus.FAILED : PaymentStatus.CANCELED,
          raw_event: input.rawEvent,
          completed_at: new Date().toISOString(),
        })
        .eq('id', existingPayment.id);

      logger.info('Payment failed/canceled', {
        action: 'payment_webhook_failed',
        correlation_id: correlationId,
        meta: { paymentId: existingPayment.id, status: input.status },
      });

      res.json({
        success: true,
        message: `Payment ${input.status}`,
        paymentId: existingPayment.id,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /payments
 * List user's payments
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const supabase = getSupabaseClient();

    const { data: payments, error } = await supabase
      .from('payments')
      .select('*')
      .eq('profile_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    res.json({ payments: payments || [] });
  } catch (error) {
    next(error);
  }
});

export default router;
