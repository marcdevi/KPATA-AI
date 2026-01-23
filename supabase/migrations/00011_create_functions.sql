-- Migration: Create database functions
-- Description: Credit balance, job creation, and refund functions

 /*
  NOTE:
  Schema already applied via supabase/migrations/00000_combined.sql.
  This migration is intentionally kept as a NO-OP to avoid duplicate object errors.
 */

 /*
-- ============================================
-- GET CREDIT BALANCE FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_credit_balance(p_profile_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0)
  INTO v_balance
  FROM credit_ledger
  WHERE profile_id = p_profile_id;
  
  RETURN v_balance;
END;
$$;

COMMENT ON FUNCTION get_credit_balance IS 'Returns the current credit balance for a profile';

-- ============================================
-- CREATE JOB AND DEBIT (ATOMIC, IDEMPOTENT)
-- ============================================

CREATE OR REPLACE FUNCTION create_job_and_debit(
  p_profile_id UUID,
  p_idempotency_key VARCHAR(255),
  p_category job_category DEFAULT 'clothing',
  p_background_style background_style DEFAULT 'studio_white',
  p_template_layout template_layout DEFAULT 'square_1x1',
  p_mannequin_mode mannequin_mode DEFAULT 'none',
  p_source_channel source_channel DEFAULT 'mobile_app',
  p_source_message_id VARCHAR(255) DEFAULT NULL,
  p_client_request_id VARCHAR(255) DEFAULT NULL
)
RETURNS TABLE (
  job_id UUID,
  was_created BOOLEAN,
  balance_after INTEGER,
  error_code VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_job_id UUID;
  v_new_job_id UUID;
  v_current_balance INTEGER;
  v_credits_per_job INTEGER;
  v_balance_after INTEGER;
BEGIN
  -- Get credits per job from config
  SELECT (value::text)::integer 
  INTO v_credits_per_job
  FROM pricing_config 
  WHERE key = 'credits_per_job';
  
  IF v_credits_per_job IS NULL THEN
    v_credits_per_job := 1;
  END IF;

  -- Check if job already exists with this idempotency key
  SELECT j.id INTO v_existing_job_id
  FROM jobs j
  WHERE j.idempotency_key = p_idempotency_key;
  
  -- If job exists, return it without creating a new debit
  IF v_existing_job_id IS NOT NULL THEN
    SELECT get_credit_balance(p_profile_id) INTO v_balance_after;
    
    RETURN QUERY SELECT 
      v_existing_job_id,
      FALSE,
      v_balance_after,
      NULL::VARCHAR(50);
    RETURN;
  END IF;
  
  -- Check current balance
  SELECT get_credit_balance(p_profile_id) INTO v_current_balance;
  
  -- Insufficient balance
  IF v_current_balance < v_credits_per_job THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      FALSE,
      v_current_balance,
      'INSUFFICIENT_CREDITS'::VARCHAR(50);
    RETURN;
  END IF;
  
  -- Create the job
  INSERT INTO jobs (
    profile_id,
    idempotency_key,
    category,
    background_style,
    template_layout,
    mannequin_mode,
    source_channel,
    source_message_id,
    client_request_id,
    status
  ) VALUES (
    p_profile_id,
    p_idempotency_key,
    p_category,
    p_background_style,
    p_template_layout,
    p_mannequin_mode,
    p_source_channel,
    p_source_message_id,
    p_client_request_id,
    'queued'
  )
  RETURNING id INTO v_new_job_id;
  
  -- Create the debit entry
  INSERT INTO credit_ledger (
    profile_id,
    entry_type,
    amount,
    job_id,
    idempotency_key,
    description
  ) VALUES (
    p_profile_id,
    'debit_job',
    -v_credits_per_job,
    v_new_job_id,
    'debit_' || p_idempotency_key,
    'Job creation debit'
  );
  
  -- Get new balance
  SELECT get_credit_balance(p_profile_id) INTO v_balance_after;
  
  RETURN QUERY SELECT 
    v_new_job_id,
    TRUE,
    v_balance_after,
    NULL::VARCHAR(50);
END;
$$;

COMMENT ON FUNCTION create_job_and_debit IS 'Atomically creates a job and debits credits. Idempotent - same idempotency_key returns existing job without re-debiting.';

-- ============================================
-- REFUND JOB ONCE (IDEMPOTENT)
-- ============================================

CREATE OR REPLACE FUNCTION refund_job_once(p_job_id UUID)
RETURNS TABLE (
  refund_created BOOLEAN,
  refund_amount INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job RECORD;
  v_credits_per_job INTEGER;
  v_existing_refund UUID;
BEGIN
  -- Get the job
  SELECT j.*, p.id as profile_id
  INTO v_job
  FROM jobs j
  JOIN profiles p ON p.id = j.profile_id
  WHERE j.id = p_job_id;
  
  IF v_job IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Job not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check if refund already exists
  SELECT id INTO v_existing_refund
  FROM credit_ledger
  WHERE job_id = p_job_id AND entry_type = 'refund_job';
  
  IF v_existing_refund IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Refund already exists'::TEXT;
    RETURN;
  END IF;
  
  -- Get credits per job from config
  SELECT (value::text)::integer 
  INTO v_credits_per_job
  FROM pricing_config 
  WHERE key = 'credits_per_job';
  
  IF v_credits_per_job IS NULL THEN
    v_credits_per_job := 1;
  END IF;
  
  -- Create the refund entry
  BEGIN
    INSERT INTO credit_ledger (
      profile_id,
      entry_type,
      amount,
      job_id,
      idempotency_key,
      description
    ) VALUES (
      v_job.profile_id,
      'refund_job',
      v_credits_per_job,
      p_job_id,
      'refund_' || p_job_id::text,
      'Automatic refund for failed job'
    );
    
    RETURN QUERY SELECT TRUE, v_credits_per_job, NULL::TEXT;
  EXCEPTION WHEN unique_violation THEN
    -- Refund already exists (race condition handled)
    RETURN QUERY SELECT FALSE, 0, 'Refund already exists (concurrent)'::TEXT;
  END;
END;
$$;

COMMENT ON FUNCTION refund_job_once IS 'Creates a refund for a job. Idempotent - only one refund per job is allowed.';

-- ============================================
-- TRIGGER: AUTO REFUND ON JOB FAILURE
-- ============================================

CREATE OR REPLACE FUNCTION trigger_refund_on_job_failure()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when status changes to 'failed'
  IF NEW.status = 'failed' AND (OLD.status IS NULL OR OLD.status <> 'failed') THEN
    PERFORM refund_job_once(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER jobs_auto_refund_on_failure
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refund_on_job_failure();

COMMENT ON TRIGGER jobs_auto_refund_on_failure ON jobs IS 'Automatically refunds credits when a job fails';

-- ============================================
-- PROCESS PAYMENT AND TOPUP (IDEMPOTENT)
-- ============================================

CREATE OR REPLACE FUNCTION process_payment_topup(
  p_profile_id UUID,
  p_provider payment_provider,
  p_provider_ref VARCHAR(255),
  p_pack_code VARCHAR(50),
  p_amount_xof INTEGER,
  p_phone_e164 VARCHAR(20) DEFAULT NULL,
  p_raw_event JSONB DEFAULT NULL
)
RETURNS TABLE (
  payment_id UUID,
  was_created BOOLEAN,
  credits_added INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_existing_payment RECORD;
  v_new_payment_id UUID;
  v_pack RECORD;
BEGIN
  -- Check if payment already exists
  SELECT * INTO v_existing_payment
  FROM payments
  WHERE provider = p_provider AND provider_ref = p_provider_ref;
  
  IF v_existing_payment IS NOT NULL THEN
    -- Payment already processed
    RETURN QUERY SELECT 
      v_existing_payment.id,
      FALSE,
      v_existing_payment.credits_granted,
      'Payment already processed'::TEXT;
    RETURN;
  END IF;
  
  -- Get pack details
  SELECT * INTO v_pack
  FROM credit_packs
  WHERE code = p_pack_code AND active = true;
  
  IF v_pack IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID,
      FALSE,
      0,
      'Invalid pack code'::TEXT;
    RETURN;
  END IF;
  
  -- Create payment record
  INSERT INTO payments (
    profile_id,
    provider,
    provider_ref,
    pack_code,
    amount_xof,
    credits_granted,
    status,
    phone_e164,
    raw_event,
    completed_at
  ) VALUES (
    p_profile_id,
    p_provider,
    p_provider_ref,
    p_pack_code,
    p_amount_xof,
    v_pack.credits,
    'succeeded',
    p_phone_e164,
    p_raw_event,
    NOW()
  )
  RETURNING id INTO v_new_payment_id;
  
  -- Create ledger entry for topup
  INSERT INTO credit_ledger (
    profile_id,
    entry_type,
    amount,
    payment_id,
    idempotency_key,
    description
  ) VALUES (
    p_profile_id,
    'topup',
    v_pack.credits,
    v_new_payment_id,
    'topup_' || p_provider::text || '_' || p_provider_ref,
    'Credit pack purchase: ' || v_pack.name
  );
  
  RETURN QUERY SELECT 
    v_new_payment_id,
    TRUE,
    v_pack.credits,
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION process_payment_topup IS 'Processes a payment and adds credits. Idempotent - same provider_ref will not add duplicate credits.';
 */
