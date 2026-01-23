-- Test file for credit system
-- Run these tests after applying all migrations

-- ============================================
-- SETUP: Create test users
-- ============================================

DO $$
DECLARE
  v_user1_id UUID;
  v_user2_id UUID;
  v_job_id UUID;
  v_job_id_2 UUID;
  v_balance INTEGER;
  v_result RECORD;
BEGIN
  RAISE NOTICE '=== Starting Credit System Tests ===';

  -- Create test user 1
  INSERT INTO profiles (phone_e164, name, role)
  VALUES ('+2250700000001', 'Test User 1', 'user_free')
  RETURNING id INTO v_user1_id;
  RAISE NOTICE 'Created test user 1: %', v_user1_id;

  -- Create test user 2
  INSERT INTO profiles (phone_e164, name, role)
  VALUES ('+2250700000002', 'Test User 2', 'user_free')
  RETURNING id INTO v_user2_id;
  RAISE NOTICE 'Created test user 2: %', v_user2_id;

  -- ============================================
  -- TEST 1: Initial balance is 0
  -- ============================================
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 0, 'TEST 1 FAILED: Initial balance should be 0, got ' || v_balance;
  RAISE NOTICE 'TEST 1 PASSED: Initial balance is 0';

  -- ============================================
  -- TEST 2: Topup adds credits
  -- ============================================
  SELECT * INTO v_result FROM process_payment_topup(
    v_user1_id,
    'orange_money',
    'OM_REF_001',
    'PACK_5',
    1500,
    '+2250700000001'
  );
  ASSERT v_result.was_created = TRUE, 'TEST 2a FAILED: Payment should be created';
  ASSERT v_result.credits_added = 5, 'TEST 2b FAILED: Should add 5 credits';
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 5, 'TEST 2c FAILED: Balance should be 5 after topup, got ' || v_balance;
  RAISE NOTICE 'TEST 2 PASSED: Topup adds credits correctly (balance: %)', v_balance;

  -- ============================================
  -- TEST 3: Double webhook doesn't add duplicate credits
  -- ============================================
  SELECT * INTO v_result FROM process_payment_topup(
    v_user1_id,
    'orange_money',
    'OM_REF_001',  -- Same reference
    'PACK_5',
    1500,
    '+2250700000001'
  );
  ASSERT v_result.was_created = FALSE, 'TEST 3a FAILED: Payment should not be created again';
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 5, 'TEST 3b FAILED: Balance should still be 5, got ' || v_balance;
  RAISE NOTICE 'TEST 3 PASSED: Double webhook prevented (balance still: %)', v_balance;

  -- ============================================
  -- TEST 4: Create job debits credits
  -- ============================================
  SELECT * INTO v_result FROM create_job_and_debit(
    v_user1_id,
    'test_job_key_001',
    'clothing',
    'studio_white',
    'square_1x1',
    'none',
    'mobile_app'
  );
  v_job_id := v_result.job_id;
  ASSERT v_result.was_created = TRUE, 'TEST 4a FAILED: Job should be created';
  ASSERT v_result.balance_after = 4, 'TEST 4b FAILED: Balance should be 4 after debit, got ' || v_result.balance_after;
  RAISE NOTICE 'TEST 4 PASSED: Job created and debited (job: %, balance: %)', v_job_id, v_result.balance_after;

  -- ============================================
  -- TEST 5: Same idempotency key returns existing job without re-debiting
  -- ============================================
  SELECT * INTO v_result FROM create_job_and_debit(
    v_user1_id,
    'test_job_key_001',  -- Same key
    'clothing',
    'studio_white',
    'square_1x1',
    'none',
    'mobile_app'
  );
  ASSERT v_result.was_created = FALSE, 'TEST 5a FAILED: Job should not be created again';
  ASSERT v_result.job_id = v_job_id, 'TEST 5b FAILED: Should return same job ID';
  ASSERT v_result.balance_after = 4, 'TEST 5c FAILED: Balance should still be 4, got ' || v_result.balance_after;
  RAISE NOTICE 'TEST 5 PASSED: Idempotency works (same job: %, balance: %)', v_result.job_id, v_result.balance_after;

  -- ============================================
  -- TEST 6: Insufficient balance prevents job creation
  -- ============================================
  -- Use all remaining credits
  PERFORM create_job_and_debit(v_user1_id, 'test_job_key_002');
  PERFORM create_job_and_debit(v_user1_id, 'test_job_key_003');
  PERFORM create_job_and_debit(v_user1_id, 'test_job_key_004');
  PERFORM create_job_and_debit(v_user1_id, 'test_job_key_005');
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 0, 'TEST 6a FAILED: Balance should be 0, got ' || v_balance;
  
  SELECT * INTO v_result FROM create_job_and_debit(
    v_user1_id,
    'test_job_key_006'
  );
  ASSERT v_result.job_id IS NULL, 'TEST 6b FAILED: Job should not be created';
  ASSERT v_result.error_code = 'INSUFFICIENT_CREDITS', 'TEST 6c FAILED: Should return INSUFFICIENT_CREDITS error';
  RAISE NOTICE 'TEST 6 PASSED: Insufficient balance prevents job creation';

  -- ============================================
  -- TEST 7: Refund adds credits back
  -- ============================================
  -- Add more credits first
  PERFORM process_payment_topup(v_user1_id, 'mtn_money', 'MTN_REF_001', 'PACK_5', 1500);
  
  SELECT * INTO v_result FROM create_job_and_debit(v_user1_id, 'test_job_key_007');
  v_job_id_2 := v_result.job_id;
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  RAISE NOTICE 'Balance before refund: %', v_balance;
  
  SELECT * INTO v_result FROM refund_job_once(v_job_id_2);
  ASSERT v_result.refund_created = TRUE, 'TEST 7a FAILED: Refund should be created';
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 5, 'TEST 7b FAILED: Balance should be 5 after refund, got ' || v_balance;
  RAISE NOTICE 'TEST 7 PASSED: Refund adds credits back (balance: %)', v_balance;

  -- ============================================
  -- TEST 8: Double refund is prevented
  -- ============================================
  SELECT * INTO v_result FROM refund_job_once(v_job_id_2);
  ASSERT v_result.refund_created = FALSE, 'TEST 8a FAILED: Second refund should not be created';
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 5, 'TEST 8b FAILED: Balance should still be 5, got ' || v_balance;
  RAISE NOTICE 'TEST 8 PASSED: Double refund prevented (balance: %)', v_balance;

  -- ============================================
  -- TEST 9: Auto refund on job failure
  -- ============================================
  SELECT * INTO v_result FROM create_job_and_debit(v_user1_id, 'test_job_key_008');
  v_job_id_2 := v_result.job_id;
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  RAISE NOTICE 'Balance after job creation: %', v_balance;
  ASSERT v_balance = 4, 'TEST 9a FAILED: Balance should be 4 after job, got ' || v_balance;
  
  -- Fail the job (should trigger auto refund)
  UPDATE jobs SET status = 'failed', last_error_code = 'AI_GENERATION_FAILED' WHERE id = v_job_id_2;
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 5, 'TEST 9b FAILED: Balance should be 5 after auto refund, got ' || v_balance;
  RAISE NOTICE 'TEST 9 PASSED: Auto refund on job failure (balance: %)', v_balance;

  -- ============================================
  -- TEST 10: Repeated failure doesn't create multiple refunds
  -- ============================================
  -- Update job again (simulating retry)
  UPDATE jobs SET status = 'processing' WHERE id = v_job_id_2;
  UPDATE jobs SET status = 'failed' WHERE id = v_job_id_2;
  
  SELECT get_credit_balance(v_user1_id) INTO v_balance;
  ASSERT v_balance = 5, 'TEST 10 FAILED: Balance should still be 5, got ' || v_balance;
  RAISE NOTICE 'TEST 10 PASSED: Repeated failure creates only one refund (balance: %)', v_balance;

  -- ============================================
  -- CLEANUP
  -- ============================================
  DELETE FROM profiles WHERE id IN (v_user1_id, v_user2_id);
  
  RAISE NOTICE '=== All Credit System Tests PASSED ===';
END;
$$;
