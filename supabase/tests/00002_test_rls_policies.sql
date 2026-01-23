-- Test file for RLS policies
-- These tests verify that users cannot access other users' data

-- Note: These tests require setting up auth.uid() context
-- In production Supabase, this is done via JWT tokens
-- For local testing, we use set_config to simulate auth context

-- ============================================
-- HELPER FUNCTION: Set auth context
-- ============================================

CREATE OR REPLACE FUNCTION test_set_auth_uid(user_id UUID)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', user_id::text, true);
END;
$$ LANGUAGE plpgsql;

-- Override auth.uid() for testing
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- RLS TESTS
-- ============================================

DO $$
DECLARE
  v_user1_id UUID;
  v_user2_id UUID;
  v_job1_id UUID;
  v_job2_id UUID;
  v_count INTEGER;
BEGIN
  RAISE NOTICE '=== Starting RLS Policy Tests ===';

  -- Temporarily disable RLS for setup
  ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
  ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
  ALTER TABLE credit_ledger DISABLE ROW LEVEL SECURITY;

  -- Create test users
  INSERT INTO profiles (phone_e164, name, role)
  VALUES ('+2250700000011', 'RLS Test User 1', 'user_free')
  RETURNING id INTO v_user1_id;

  INSERT INTO profiles (phone_e164, name, role)
  VALUES ('+2250700000012', 'RLS Test User 2', 'user_free')
  RETURNING id INTO v_user2_id;

  -- Create jobs for each user
  INSERT INTO jobs (profile_id, idempotency_key, status)
  VALUES (v_user1_id, 'rls_test_job_1', 'queued')
  RETURNING id INTO v_job1_id;

  INSERT INTO jobs (profile_id, idempotency_key, status)
  VALUES (v_user2_id, 'rls_test_job_2', 'queued')
  RETURNING id INTO v_job2_id;

  -- Create ledger entries
  INSERT INTO credit_ledger (profile_id, entry_type, amount, job_id, idempotency_key)
  VALUES 
    (v_user1_id, 'topup', 5, NULL, 'rls_test_topup_1'),
    (v_user2_id, 'topup', 10, NULL, 'rls_test_topup_2');

  -- Re-enable RLS
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

  -- ============================================
  -- TEST 1: User 1 can only see their own profile
  -- ============================================
  PERFORM test_set_auth_uid(v_user1_id);
  
  SELECT COUNT(*) INTO v_count FROM profiles;
  ASSERT v_count = 1, 'TEST 1a FAILED: User 1 should see only 1 profile, saw ' || v_count;
  
  SELECT COUNT(*) INTO v_count FROM profiles WHERE id = v_user1_id;
  ASSERT v_count = 1, 'TEST 1b FAILED: User 1 should see their own profile';
  
  SELECT COUNT(*) INTO v_count FROM profiles WHERE id = v_user2_id;
  ASSERT v_count = 0, 'TEST 1c FAILED: User 1 should NOT see User 2 profile';
  
  RAISE NOTICE 'TEST 1 PASSED: User can only see own profile';

  -- ============================================
  -- TEST 2: User 1 can only see their own jobs
  -- ============================================
  SELECT COUNT(*) INTO v_count FROM jobs;
  ASSERT v_count = 1, 'TEST 2a FAILED: User 1 should see only 1 job, saw ' || v_count;
  
  SELECT COUNT(*) INTO v_count FROM jobs WHERE id = v_job1_id;
  ASSERT v_count = 1, 'TEST 2b FAILED: User 1 should see their own job';
  
  SELECT COUNT(*) INTO v_count FROM jobs WHERE id = v_job2_id;
  ASSERT v_count = 0, 'TEST 2c FAILED: User 1 should NOT see User 2 job';
  
  RAISE NOTICE 'TEST 2 PASSED: User can only see own jobs';

  -- ============================================
  -- TEST 3: User 1 can only see their own ledger entries
  -- ============================================
  SELECT COUNT(*) INTO v_count FROM credit_ledger;
  ASSERT v_count = 1, 'TEST 3a FAILED: User 1 should see only 1 ledger entry, saw ' || v_count;
  
  SELECT COUNT(*) INTO v_count FROM credit_ledger WHERE profile_id = v_user1_id;
  ASSERT v_count = 1, 'TEST 3b FAILED: User 1 should see their own ledger entry';
  
  SELECT COUNT(*) INTO v_count FROM credit_ledger WHERE profile_id = v_user2_id;
  ASSERT v_count = 0, 'TEST 3c FAILED: User 1 should NOT see User 2 ledger entry';
  
  RAISE NOTICE 'TEST 3 PASSED: User can only see own ledger entries';

  -- ============================================
  -- TEST 4: User 2 sees different data
  -- ============================================
  PERFORM test_set_auth_uid(v_user2_id);
  
  SELECT COUNT(*) INTO v_count FROM profiles WHERE id = v_user2_id;
  ASSERT v_count = 1, 'TEST 4a FAILED: User 2 should see their own profile';
  
  SELECT COUNT(*) INTO v_count FROM jobs WHERE id = v_job2_id;
  ASSERT v_count = 1, 'TEST 4b FAILED: User 2 should see their own job';
  
  SELECT COUNT(*) INTO v_count FROM jobs WHERE id = v_job1_id;
  ASSERT v_count = 0, 'TEST 4c FAILED: User 2 should NOT see User 1 job';
  
  RAISE NOTICE 'TEST 4 PASSED: Different user sees different data';

  -- ============================================
  -- CLEANUP
  -- ============================================
  -- Disable RLS for cleanup
  ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
  ALTER TABLE jobs DISABLE ROW LEVEL SECURITY;
  ALTER TABLE credit_ledger DISABLE ROW LEVEL SECURITY;
  
  DELETE FROM profiles WHERE id IN (v_user1_id, v_user2_id);
  
  -- Re-enable RLS
  ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
  ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;
  
  -- Clear auth context
  PERFORM set_config('request.jwt.claim.sub', '', true);
  
  RAISE NOTICE '=== All RLS Policy Tests PASSED ===';
END;
$$;

-- Cleanup helper function
DROP FUNCTION IF EXISTS test_set_auth_uid(UUID);
