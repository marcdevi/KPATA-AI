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
import { paystackInitializeTransaction, verifyPaystackSignature } from '../lib/paystack.js';
import { getSupabaseClient } from '../lib/supabase.js';
import { upgradeToProOnTopup } from '../lib/upgrade.js';
import { validateBody } from '../lib/validation.js';
import { logger } from '../logger.js';

const router: Router = Router();

async function processWebhookUpdate(input: {
  provider: PaymentProvider;
  providerRef: string;
  status: 'succeeded' | 'failed' | 'canceled';
  rawEvent?: Record<string, unknown>;
  correlationId?: string;
}): Promise<{ paymentId: string; creditsAdded?: number; alreadyProcessed?: boolean }> {
  const supabase = getSupabaseClient();

  // Find existing payment
  const { data: existingPayment, error: findError } = await supabase
    .from('payments')
    .select('*')
    .eq('provider', input.provider)
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
    return { paymentId: existingPayment.id, alreadyProcessed: true };
  }

  if (input.status === 'succeeded') {
    // Check if topup already exists in ledger (double-check idempotency)
    const { data: existingLedger } = await supabase
      .from('credit_ledger')
      .select('id')
      .eq('payment_id', existingPayment.id)
      .eq('entry_type', 'topup')
      .single();

    if (existingLedger) {
      return { paymentId: existingPayment.id, alreadyProcessed: true };
    }

    await supabase
      .from('payments')
      .update({
        status: PaymentStatus.SUCCEEDED,
        raw_event: input.rawEvent,
        completed_at: new Date().toISOString(),
      })
      .eq('id', existingPayment.id);

    const idempotencyKey = `topup_${input.provider}_${input.providerRef}`;

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
      if (ledgerError.code !== '23505') {
        throw ledgerError;
      }
    }

    try {
      await upgradeToProOnTopup(existingPayment.profile_id, input.correlationId);
    } catch (upgradeError) {
      logger.error('Failed to upgrade user to pro', {
        action: 'payment_webhook_upgrade_error',
        correlation_id: input.correlationId,
        user_id: existingPayment.profile_id,
        meta: { error: String(upgradeError) },
      });
    }

    return { paymentId: existingPayment.id, creditsAdded: existingPayment.credits_granted };
  }

  await supabase
    .from('payments')
    .update({
      status: input.status === 'failed' ? PaymentStatus.FAILED : PaymentStatus.CANCELED,
      raw_event: input.rawEvent,
      completed_at: new Date().toISOString(),
    })
    .eq('id', existingPayment.id);

  return { paymentId: existingPayment.id };
}

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
    const userId = req.user!.id;

    // Normalize phone if provided
    const phoneE164 = input.phoneE164 ? normalizePhone(input.phoneE164) : req.user!.phone;

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

    // Paystack: initialize transaction and return checkout url
    if (input.provider === PaymentProvider.PAYSTACK) {
      const email = req.user.email;
      if (!email) {
        throw new BadRequestError('Email is required for Paystack payments');
      }

      // Construct callback URL for redirect after payment
      const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3001';
      const callbackUrl = `${webAppUrl}/payment-callback?reference=${encodeURIComponent(providerRef)}`;

      const { authorizationUrl } = await paystackInitializeTransaction({
        email,
        // Paystack expects minor units
        amount: pack.price_xof * 100,
        currency: 'XOF',
        reference: providerRef,
        callbackUrl,
        metadata: {
          paymentId: payment.id,
          profileId: userId,
          packCode: input.packCode,
          creditsGranted: pack.credits,
        },
      });

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
        redirectUrl: authorizationUrl,
      });
      return;
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
 * POST /payments/webhook/paystack
 * Paystack webhook handler
 */
router.post('/webhook/paystack', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const correlationId = req.correlationId;
    const signature = req.headers['x-paystack-signature'] as string | undefined;
    const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

    if (!rawBody || !verifyPaystackSignature(rawBody, signature)) {
      throw new UnauthorizedError('Invalid Paystack signature');
    }

    const event = req.body as { event?: string; data?: { reference?: string; status?: string } };
    const reference = event.data?.reference;
    const status = event.data?.status;

    if (!reference || !status) {
      throw new BadRequestError('Invalid Paystack payload');
    }

    const normalizedStatus: 'succeeded' | 'failed' | 'canceled' | 'pending' =
      status === 'success' ? 'succeeded' : status === 'failed' ? 'failed' : status === 'abandoned' ? 'canceled' : 'pending';

    logger.info('Paystack verify normalized status', {
      action: 'paystack_verify_normalized',
      correlation_id: correlationId,
      user_id: req.user!.id,
      meta: { reference, normalizedStatus },
    });

    if (normalizedStatus === 'pending') {
      logger.info('Paystack webhook received but still pending', {
        action: 'paystack_webhook_pending',
        correlation_id: correlationId,
        meta: { reference, status },
      });
      res.json({ success: true });
      return;
    }

    const result = await processWebhookUpdate({
      provider: PaymentProvider.PAYSTACK,
      providerRef: reference,
      status: normalizedStatus,
      rawEvent: req.body,
      correlationId,
    });

    logger.info('Paystack webhook processed', {
      action: 'paystack_webhook_processed',
      correlation_id: correlationId,
      meta: { reference, normalizedStatus, paymentId: result.paymentId },
    });

    res.json({ success: true });
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

    logger.info('Payment webhook received', {
      action: 'payment_webhook_received',
      correlation_id: correlationId,
      meta: { provider, providerRef: input.providerRef, status: input.status },
    });

    const result = await processWebhookUpdate({
      provider,
      providerRef: input.providerRef,
      status: input.status,
      rawEvent: input.rawEvent,
      correlationId,
    });

    res.json({
      success: true,
      message: result.alreadyProcessed ? 'Payment already processed' : 'Payment processed',
      paymentId: result.paymentId,
      creditsAdded: result.creditsAdded,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /payments/verify/:reference
 * Check payment status (no auth required for callback page)
 * This endpoint only checks the DB status - actual validation is done by webhook
 */
router.get('/verify/:reference', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const correlationId = req.correlationId;
    const reference = req.params.reference;
    if (!reference) {
      throw new BadRequestError('Missing reference');
    }

    const supabase = getSupabaseClient();

    // Find payment by reference
    const { data: payment, error: findError } = await supabase
      .from('payments')
      .select('*')
      .eq('provider', PaymentProvider.PAYSTACK)
      .eq('provider_ref', reference)
      .single();

    if (findError || !payment) {
      logger.warn('Payment not found for verification', {
        action: 'payment_verify_not_found',
        correlation_id: correlationId,
        meta: { reference },
      });
      res.json({
        ok: true,
        status: 'pending',
      });
      return;
    }

    logger.info('Payment status check', {
      action: 'payment_verify_status',
      correlation_id: correlationId,
      meta: { reference, status: payment.status },
    });

    // Map DB status to response status
    let status: 'succeeded' | 'failed' | 'canceled' | 'pending' = 'pending';
    if (payment.status === PaymentStatus.SUCCEEDED) {
      status = 'succeeded';
    } else if (payment.status === PaymentStatus.FAILED) {
      status = 'failed';
    } else if (payment.status === PaymentStatus.CANCELED) {
      status = 'canceled';
    }

    res.json({
      ok: true,
      status,
      paymentId: payment.id,
      creditsAdded: payment.status === PaymentStatus.SUCCEEDED ? payment.credits_granted : undefined,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /payments/test-success/:reference
 * DEV ONLY: Manually mark a payment as succeeded for testing
 */
router.get('/test-success/:reference', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // SECURITY: Only allow in development
    if (process.env.NODE_ENV === 'production') {
      throw new UnauthorizedError('Test endpoint disabled in production');
    }

    const reference = Array.isArray(req.params.reference) ? req.params.reference[0] : req.params.reference;
    const correlationId = req.correlationId;

    const result = await processWebhookUpdate({
      provider: PaymentProvider.PAYSTACK,
      providerRef: reference,
      status: 'succeeded',
      rawEvent: { test: true },
      correlationId,
    });

    res.json({
      success: true,
      message: 'Payment marked as succeeded (DEV ONLY)',
      paymentId: result.paymentId,
      creditsAdded: result.creditsAdded,
    });
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
