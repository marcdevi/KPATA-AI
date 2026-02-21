-- Migration: Update credit cost for mannequin jobs
-- Description: Charge 2 credits for custom mannequin jobs, 1 credit for others

-- ============================================
-- UPDATE CREATE JOB AND DEBIT FUNCTION
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
  -- Determine credit cost based on mannequin mode
  -- Custom mannequin mode costs 2 credits (uses gemini-3-pro-image-preview)
  -- All other modes cost 1 credit (uses gemini-2.5-flash-image)
  IF p_mannequin_mode = 'custom' THEN
    v_credits_per_job := 2;
  ELSE
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
    CASE 
      WHEN p_mannequin_mode = 'custom' THEN 'Job creation debit (custom mannequin - 2 credits)'
      ELSE 'Job creation debit (1 credit)'
    END
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

COMMENT ON FUNCTION create_job_and_debit IS 'Atomically creates a job and debits credits. Custom mannequin mode costs 2 credits, others cost 1 credit. Idempotent - same idempotency_key returns existing job without re-debiting.';
